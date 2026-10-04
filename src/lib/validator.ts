import type { Issue, Severity } from "./types";

/**
 * Contract format (example-driven, JSON):
 *   - leaf:    "string" | "number" | "integer" | "boolean" | "null" | "object" | "array" | "any"
 *              union with "|"  -> "string|null"
 *              optional with trailing "?" -> "number?"  (field may be absent)
 *   - object:  { "field": <contract>, "optionalField?": <contract> }
 *   - array:   [ <item contract> ]   (or [] for "any array")
 */

const LEAF_TYPES = ["string", "number", "integer", "boolean", "null", "object", "array", "any"] as const;
type LeafType = (typeof LEAF_TYPES)[number];

export const MAX_ISSUES = 100;
export const MAX_CONTRACT_DEPTH = 20;

export class ContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractError";
  }
}

export type Schema =
  | { kind: "leaf"; types: LeafType[]; optional: boolean }
  | { kind: "object"; fields: { key: string; schema: Schema }[]; optional: boolean }
  | { kind: "array"; item: Schema | null; optional: boolean };

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const childPath = (parent: string, key: string) => (parent === "$" ? key : `${parent}.${key}`);

/** Compile a parsed contract into a normalized schema tree. Throws ContractError if malformed. */
export function compileContract(node: unknown, path = "$", depth = 0): Schema {
  if (depth > MAX_CONTRACT_DEPTH) {
    throw new ContractError(`Contract is nested deeper than ${MAX_CONTRACT_DEPTH} levels at "${path}".`);
  }

  if (typeof node === "string") {
    let raw = node.trim().toLowerCase();
    let optional = false;
    if (raw.endsWith("?")) {
      optional = true;
      raw = raw.slice(0, -1).trim();
    }
    const types = raw.split("|").map((t) => t.trim());
    for (const t of types) {
      if (!(LEAF_TYPES as readonly string[]).includes(t)) {
        throw new ContractError(
          `Unknown type "${t}" at "${path}". Use one of: ${LEAF_TYPES.join(", ")} (combine with "|", suffix "?" for optional).`,
        );
      }
    }
    return { kind: "leaf", types: types as LeafType[], optional };
  }

  if (Array.isArray(node)) {
    if (node.length > 1) {
      throw new ContractError(`Array contract at "${path}" must contain at most one item contract (found ${node.length}).`);
    }
    return {
      kind: "array",
      item: node.length === 1 ? compileContract(node[0], `${path}[]`, depth + 1) : null,
      optional: false,
    };
  }

  if (isPlainObject(node)) {
    const fields = Object.entries(node).map(([rawKey, value]) => {
      let key = rawKey;
      let keyOptional = false;
      if (key.endsWith("?") && key.length > 1) {
        key = key.slice(0, -1);
        keyOptional = true;
      }
      const schema = compileContract(value, childPath(path, key), depth + 1);
      if (keyOptional) schema.optional = true;
      return { key, schema };
    });
    return { kind: "object", fields, optional: false };
  }

  throw new ContractError(
    `Invalid contract value at "${path}": expected a type name string (e.g. "string"), an object, or an array — got ${describeValue(node)}.`,
  );
}

export function describeValue(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number") return Number.isInteger(v) ? "number (integer)" : "number";
  return typeof v; // string | boolean | object
}

export function describeSchema(s: Schema): string {
  if (s.kind === "leaf") return s.types.join(" | ");
  if (s.kind === "object") return "object";
  return s.item ? `array<${describeSchema(s.item)}>` : "array";
}

function matchesLeaf(types: LeafType[], v: unknown): boolean {
  return types.some((t) => {
    switch (t) {
      case "any":
        return true;
      case "string":
        return typeof v === "string";
      case "number":
        return typeof v === "number";
      case "integer":
        return typeof v === "number" && Number.isInteger(v);
      case "boolean":
        return typeof v === "boolean";
      case "null":
        return v === null;
      case "object":
        return isPlainObject(v);
      case "array":
        return Array.isArray(v);
    }
  });
}

const MESSAGES: Record<Issue["type"], (i: Pick<Issue, "path" | "expected" | "actual">) => string> = {
  missing_field: (i) => `Required field "${i.path}" is missing from the response (expected ${i.expected}).`,
  unexpected_field: (i) => `Field "${i.path}" is not defined in the contract (received ${i.actual}).`,
  type_mismatch: (i) => `"${i.path}" has the wrong type: expected ${i.expected} but received ${i.actual}.`,
  null_value: (i) => `"${i.path}" is null but the contract expects ${i.expected}.`,
  structure_mismatch: (i) => `"${i.path}" has the wrong structure: expected ${i.expected} but received ${i.actual}.`,
};

/** Compare a parsed actual value against a compiled schema. Pure and deterministic. */
export function validate(schema: Schema, actual: unknown): { issues: Issue[]; truncated: boolean } {
  const issues: Issue[] = [];
  let truncated = false;

  const push = (
    path: string,
    type: Issue["type"],
    severity: Severity,
    expected: string,
    actualDesc: string,
  ) => {
    if (issues.length >= MAX_ISSUES) {
      truncated = true;
      return;
    }
    issues.push({ path, type, severity, expected, actual: actualDesc, message: MESSAGES[type]({ path, expected, actual: actualDesc }) });
  };

  const walk = (s: Schema, v: unknown, path: string) => {
    const expected = describeSchema(s);
    const isRoot = path === "$";

    if (s.kind === "leaf") {
      if (matchesLeaf(s.types, v)) return;
      if (v === null) return push(path, "null_value", "high", expected, "null");
      const structural = v !== null && typeof v === "object"
        ? true
        : s.types.some((t) => t === "object" || t === "array");
      if (structural) {
        return push(path, "structure_mismatch", isRoot ? "critical" : "high", expected, describeValue(v));
      }
      return push(path, "type_mismatch", isRoot ? "critical" : "medium", expected, describeValue(v));
    }

    if (s.kind === "object") {
      if (v === null) return push(path, "null_value", isRoot ? "critical" : "high", "object", "null");
      if (!isPlainObject(v)) {
        return push(path, "structure_mismatch", isRoot ? "critical" : "high", "object", describeValue(v));
      }
      for (const f of s.fields) {
        const p = childPath(path, f.key);
        if (!Object.prototype.hasOwnProperty.call(v, f.key)) {
          if (!f.schema.optional) push(p, "missing_field", "high", describeSchema(f.schema), "undefined (absent)");
          continue;
        }
        walk(f.schema, v[f.key], p);
      }
      const known = new Set(s.fields.map((f) => f.key));
      for (const key of Object.keys(v)) {
        if (!known.has(key)) push(childPath(path, key), "unexpected_field", "low", "not defined in contract", describeValue(v[key]));
      }
      return;
    }

    // array
    if (v === null) return push(path, "null_value", isRoot ? "critical" : "high", expected, "null");
    if (!Array.isArray(v)) {
      return push(path, "structure_mismatch", isRoot ? "critical" : "high", expected, describeValue(v));
    }
    if (!s.item) return;
    for (let i = 0; i < v.length; i++) {
      if (issues.length >= MAX_ISSUES) {
        truncated = true;
        break;
      }
      walk(s.item, v[i], `${path}[${i}]`);
    }
  };

  walk(schema, actual, "$");
  return { issues, truncated };
}

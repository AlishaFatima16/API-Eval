import type { Issue, TestCase } from "./types";
import type { Schema } from "./validator";

const MAX_TESTS = 12;

function sampleForType(t: string): unknown {
  switch (t.trim()) {
    case "string":
      return "example";
    case "number":
      return 1.5;
    case "integer":
      return 1;
    case "boolean":
      return true;
    case "null":
      return null;
    case "object":
      return {};
    case "array":
      return [];
    default:
      return "example";
  }
}

/** Build a valid sample payload from a contract. */
export function sampleFromSchema(s: Schema): unknown {
  if (s.kind === "leaf") return sampleForType(s.types.find((t) => t !== "null") ?? s.types[0]);
  if (s.kind === "object") return Object.fromEntries(s.fields.map((f) => [f.key, sampleFromSchema(f.schema)]));
  return s.item ? [sampleFromSchema(s.item)] : [];
}

/** Wrap a leaf value in the nested structure described by an issue path ("a.b[0].c"). */
function wrapAtPath(path: string, value: unknown): unknown {
  if (path === "$") return value;
  const tokens = path.replace(/^\$/, "").match(/[^.[\]]+|\[\d+\]/g) ?? [];
  let out: unknown = value;
  for (const tok of [...tokens].reverse()) {
    out = tok.startsWith("[") ? [out] : { [tok]: out };
  }
  return out;
}

function parentOf(path: string): string {
  const idx = Math.max(path.lastIndexOf("."), path.lastIndexOf("["));
  return idx <= 0 ? "$" : path.slice(0, idx);
}

function leafName(path: string): string {
  return path.slice(Math.max(path.lastIndexOf("."), path.lastIndexOf("[")) + 1);
}

/** Deterministic test cases derived from detected issues (plus one positive baseline). */
export function generateTestCases(schema: Schema, issues: Issue[]): TestCase[] {
  const tests: TestCase[] = [];
  const seen = new Set<string>();
  const add = (t: TestCase) => {
    if (!seen.has(t.name) && tests.length < MAX_TESTS) {
      seen.add(t.name);
      tests.push(t);
    }
  };

  for (const i of issues) {
    const p = i.path;
    switch (i.type) {
      case "type_mismatch":
      case "structure_mismatch":
        add({
          name: `Reject ${p} when supplied as ${i.actual}`,
          purpose: `Ensure the API enforces the contract type (${i.expected}) for "${p}".`,
          input: wrapAtPath(p, i.actual.startsWith("string") ? "18" : i.actual === "array" ? [] : i.actual === "object" ? {} : "invalid"),
          expected: "Validation error / HTTP 400 identifying the field and expected type",
          kind: "negative",
          source: "deterministic",
        });
        add({
          name: `Accept ${p} when supplied as ${i.expected.split(" | ")[0]}`,
          purpose: `Confirm a correctly typed "${p}" passes validation.`,
          input: wrapAtPath(p, sampleForType(i.expected.split(" | ")[0].replace(/^array<.*>$/, "array"))),
          expected: "Accepted (HTTP 200/201)",
          kind: "positive",
          source: "deterministic",
        });
        break;
      case "null_value":
        add({
          name: `Reject null for ${p}`,
          purpose: `Ensure "${p}" cannot silently be null when the contract requires ${i.expected}.`,
          input: wrapAtPath(p, null),
          expected: "Validation error / HTTP 400, or a documented non-null default",
          kind: "negative",
          source: "deterministic",
        });
        break;
      case "missing_field":
        add({
          name: `Reject payload missing ${p}`,
          purpose: `Ensure required field "${p}" is always present.`,
          input: wrapAtPath(parentOf(p), {}),
          expected: `Validation error / HTTP 400 stating "${leafName(p)}" is required`,
          kind: "negative",
          source: "deterministic",
        });
        break;
      case "unexpected_field":
        add({
          name: `Strip or reject unexpected field ${p}`,
          purpose: `Prevent undocumented field "${p}" from leaking through or being accepted (mass-assignment / contract drift risk).`,
          input: wrapAtPath(p, "unexpected-value"),
          expected: "Field rejected (HTTP 400) or ignored/stripped from the stored/returned data",
          kind: "negative",
          source: "deterministic",
        });
        break;
    }
  }

  add({
    name: "Accept a fully conforming payload",
    purpose: "Baseline: a payload matching the contract exactly should pass with no violations.",
    input: sampleFromSchema(schema),
    expected: "Accepted (HTTP 200/201) with zero contract violations",
    kind: "positive",
    source: "deterministic",
  });

  return tests;
}

import { describe, expect, it } from "vitest";
import { InputError, runCoreAnalysis } from "@/lib/analyze";
import { DEMO_CONTRACT, DEMO_RESPONSE } from "@/lib/demo";
import { classify, computeScore } from "@/lib/scoring";

const run = (c: unknown, r: unknown) => runCoreAnalysis(JSON.stringify(c), JSON.stringify(r));
const types = (c: unknown, r: unknown) => run(c, r).issues.map((i) => `${i.path}:${i.type}:${i.severity}`);

describe("validator", () => {
  it("valid contract -> no issues, score 100", () => {
    const r = run({ name: "string", age: "number" }, { name: "A", age: 3 });
    expect(r.issues).toEqual([]);
    expect(r.score).toMatchObject({ score: 100, rating: "Excellent" });
  });
  it("missing field", () => {
    expect(types({ a: "string", b: "number" }, { a: "x" })).toEqual(["b:missing_field:high"]);
  });
  it("optional field may be absent (value and key suffix)", () => {
    expect(types({ a: "string", "b?": "number", c: "string?" }, { a: "x" })).toEqual([]);
  });
  it("unexpected field", () => {
    expect(types({ a: "string" }, { a: "x", extra: 1 })).toEqual(["extra:unexpected_field:low"]);
  });
  it("type mismatch", () => {
    expect(types({ age: "number" }, { age: "17" })).toEqual(["age:type_mismatch:medium"]);
    expect(types({ n: "integer" }, { n: 1.5 })).toEqual(["n:type_mismatch:medium"]);
  });
  it("null value, and nullable union allows null", () => {
    expect(types({ e: "string" }, { e: null })).toEqual(["e:null_value:high"]);
    expect(types({ e: "string|null" }, { e: null })).toEqual([]);
  });
  it("nested object mismatch + nested type mismatch", () => {
    expect(types({ user: { address: { zip: "string" } } }, { user: { address: { zip: 12345 } } })).toEqual([
      "user.address.zip:type_mismatch:medium",
    ]);
    expect(types({ user: { name: "string" } }, { user: "bob" })).toEqual(["user:structure_mismatch:high"]);
    expect(types({ user: { name: "string" } }, { user: null })).toEqual(["user:null_value:high"]);
  });
  it("array/object mismatch", () => {
    expect(types({ tags: ["string"] }, { tags: { a: 1 } })).toEqual(["tags:structure_mismatch:high"]);
    expect(types({ o: { a: "string" } }, { o: [] })).toEqual(["o:structure_mismatch:high"]);
    expect(types({ tags: ["string"] }, { tags: ["a", 2, "c", null] })).toEqual([
      "tags[1]:type_mismatch:medium",
      "tags[3]:null_value:high",
    ]);
  });
  it("root-level mismatch is critical", () => {
    expect(types({ a: "string" }, [1])).toEqual(["$:structure_mismatch:critical"]);
  });
  it("array of objects contract", () => {
    expect(types([{ id: "number" }], [{ id: 1 }, { id: "2" }])).toEqual(["$[1].id:type_mismatch:medium"]);
  });
  it("caps issues at 100 and flags truncation", () => {
    const r = run(["string"], Array.from({ length: 500 }, () => 1));
    expect(r.issues.length).toBe(100);
    expect(r.truncated).toBe(true);
  });
  it("demo flow: null + type mismatch + unexpected field = 74", () => {
    const r = runCoreAnalysis(DEMO_CONTRACT, DEMO_RESPONSE);
    expect(r.issues.map((i) => i.path).sort()).toEqual(["user.age", "user.email", "user.role"]);
    expect(r.score).toMatchObject({ score: 74, rating: "Needs Attention" });
    expect(r.testCases.length).toBeGreaterThan(3);
    expect(r.testCases.some((t) => t.name.includes("user.age"))).toBe(true);
  });
});

describe("input handling", () => {
  const msg = (c: string, r: string) => {
    try {
      runCoreAnalysis(c, r);
    } catch (e) {
      expect(e).toBeInstanceOf(InputError);
      return (e as InputError).message;
    }
    throw new Error("expected InputError");
  };
  it("invalid JSON", () => {
    expect(msg("{bad", "{}")).toMatch(/Expected API Contract is not valid JSON/);
    expect(msg('{"a":"string"}', "{bad")).toMatch(/Actual API Response is not valid JSON/);
  });
  it("empty input", () => {
    expect(msg("", "{}")).toMatch(/Expected API Contract is empty/);
    expect(msg('{"a":"string"}', "   ")).toMatch(/Actual API Response is empty/);
  });
  it("malformed schema", () => {
    expect(msg('{"a":"strng"}', "{}")).toMatch(/Malformed contract.*Unknown type/);
    expect(msg('{"a":5}', "{}")).toMatch(/Malformed contract/);
    expect(msg('{"a":null}', "{}")).toMatch(/Malformed contract/);
    expect(msg('{"a":["string","number"]}', "{}")).toMatch(/at most one/);
  });
  it("too large input and too-deep contract", () => {
    expect(msg(`"${"x".repeat(200_001)}"`, "{}")).toMatch(/too large/);
    let deep = '"string"';
    for (let i = 0; i < 30; i++) deep = `{"a":${deep}}`;
    expect(msg(deep, "{}")).toMatch(/deeper than/);
  });
});

describe("scoring", () => {
  it("applies deductions, floors at 0, classifies", () => {
    const mk = (severity: "critical" | "high" | "medium" | "low", n: number) =>
      Array.from({ length: n }, () => ({ path: "p", type: "type_mismatch" as const, severity, expected: "", actual: "", message: "" }));
    expect(computeScore([...mk("high", 1), ...mk("medium", 1), ...mk("low", 1)]).score).toBe(74);
    expect(computeScore(mk("critical", 10)).score).toBe(0);
    expect([100, 99, 80, 79, 60, 59, 40, 39, 0].map(classify)).toEqual([
      "Excellent", "Good", "Good", "Needs Attention", "Needs Attention", "Poor", "Poor", "Critical", "Critical",
    ]);
  });
});

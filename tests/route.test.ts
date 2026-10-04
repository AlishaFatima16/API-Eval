import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/analyze/route";
import { DEMO_CONTRACT, DEMO_RESPONSE } from "@/lib/demo";

const call = (body: unknown, raw = false) =>
  POST(new Request("http://x/api/analyze", { method: "POST", body: raw ? (body as string) : JSON.stringify(body) }));

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/analyze", () => {
  it("demo flow works with AI unavailable", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    const res = await call({ contract: DEMO_CONTRACT, response: DEMO_RESPONSE });
    const j = await res.json();
    expect(res.status).toBe(200);
    expect(j.ok).toBe(true);
    expect(j.score.score).toBe(74);
    expect(j.issues).toHaveLength(3);
    expect(j.ai).toBeNull();
    expect(j.aiError).toBeTruthy();
    expect(j.testCases.length).toBeGreaterThan(0);
  });
  it("400 on invalid JSON / empty / malformed schema / bad body", async () => {
    for (const [body, field] of [
      [{ contract: "{x", response: "{}" }, "contract"],
      [{ contract: "{}", response: "" }, "response"],
      [{ contract: '{"a":"nope"}', response: "{}" }, "contract"],
      [{}, "contract"],
    ] as const) {
      const res = await call(body);
      expect(res.status).toBe(400);
      expect((await res.json()).field).toBe(field);
    }
    expect((await call("not json", true)).status).toBe(400);
    expect((await call("null", true)).status).toBe(400);
  });
  it("413 on oversized body", async () => {
    expect((await call("x".repeat(500_000), true)).status).toBe(413);
  });
});

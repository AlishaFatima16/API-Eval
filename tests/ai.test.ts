import { afterEach, describe, expect, it, vi } from "vitest";
import { explainWithAi, extractJson, groqEndpoint, normalizeAi } from "@/lib/ai";
import { runCoreAnalysis } from "@/lib/analyze";
import { DEMO_CONTRACT, DEMO_RESPONSE } from "@/lib/demo";

const core = () => runCoreAnalysis(DEMO_CONTRACT, DEMO_RESPONSE);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("AI layer", () => {
  it("no API key -> graceful null with message (core still works)", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    const c = core();
    const r = await explainWithAi(c.issues, c.score);
    expect(r.ai).toBeNull();
    expect(r.error).toMatch(/not configured/);
    expect(c.score.score).toBe(74);
  });
  it("API failure (HTTP 500) -> graceful", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 500 })));
    const c = core();
    const r = await explainWithAi(c.issues, c.score);
    expect(r.ai).toBeNull();
    expect(r.error).toMatch(/unavailable/);
  });
  it("network error and garbage reply -> graceful", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    const c = core();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    expect((await explainWithAi(c.issues, c.score)).ai).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: "not json" } }] })));
    expect((await explainWithAi(c.issues, c.score)).ai).toBeNull();
  });
  it("valid reply is parsed; invented paths are dropped", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    const reply = "```json\n" + JSON.stringify({
      summary: "Three problems.",
      keyIssues: [{ path: "user.age", explanation: "string", impact: "breaks math" }, { path: "made.up", explanation: "x", impact: "y" }],
      recommendations: ["Fix it"],
      testCases: [{ name: "Reject age string", purpose: "p", input: { user: { age: "17" } }, expected: "400" }],
    }) + "\n```";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: reply } }] })));
    const c = core();
    const r = await explainWithAi(c.issues, c.score);
    expect(r.error).toBeNull();
    expect(r.ai?.keyIssues.map((k) => k.path)).toEqual(["user.age"]);
    expect(r.ai?.testCases).toHaveLength(1);
  });
  it("helpers reject bad shapes", () => {
    expect(() => extractJson("nothing")).toThrow();
    expect(() => normalizeAi({ summary: "" }, [])).toThrow();
    expect(() => normalizeAi(null, [])).toThrow();
  });
});

describe("Groq request format", () => {
  it("normalizes the endpoint from any reasonable GROQ_BASE_URL", () => {
    const full = "https://api.groq.com/openai/v1/chat/completions";
    expect(groqEndpoint("")).toBe(full);
    expect(groqEndpoint("https://api.groq.com")).toBe(full);
    expect(groqEndpoint("https://api.groq.com/")).toBe(full);
    expect(groqEndpoint("https://api.groq.com/openai/v1")).toBe(full);
    expect(groqEndpoint("https://api.groq.com/openai/v1/")).toBe(full);
    expect(groqEndpoint(full)).toBe(full);
    expect(() => groqEndpoint("not a url")).toThrow();
  });
  it("posts an OpenAI-style chat completion with env-configured model, tolerating messy .env values", async () => {
    vi.stubEnv("GROQ_API_KEY", "  test-key\r");
    vi.stubEnv("GROQ_MODEL", '"my-model"\r');
    vi.stubEnv("GROQ_BASE_URL", "https://api.groq.com\r");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: "{}" } }] }));
    vi.stubGlobal("fetch", fetchMock);
    const c = core();
    await explainWithAi(c.issues, c.score);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(init.headers.authorization).toBe("Bearer test-key");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("my-model");
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual(["system", "user"]);
    expect(body.response_format).toEqual({ type: "json_object" });
  });
  it("HTTP 404 from Groq falls back gracefully", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: { message: "model not found" } }, { status: 404 })));
    const c = core();
    const r = await explainWithAi(c.issues, c.score);
    expect(r.ai).toBeNull();
    expect(r.error).toMatch(/unavailable/);
  });
  it("gpt-oss models get light reasoning and headroom for output", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    vi.stubEnv("GROQ_MODEL", "openai/gpt-oss-120b");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: "{}" } }] }));
    vi.stubGlobal("fetch", fetchMock);
    const c = core();
    await explainWithAi(c.issues, c.score);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe("openai/gpt-oss-120b");
    expect(body.reasoning_effort).toBe("low");
    expect(body.max_completion_tokens).toBeGreaterThanOrEqual(4000);
  });
  it("does not send reasoning_effort to non-reasoning models", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    vi.stubEnv("GROQ_MODEL", "some-other-model");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: "{}" } }] }));
    vi.stubGlobal("fetch", fetchMock);
    const c = core();
    await explainWithAi(c.issues, c.score);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).reasoning_effort).toBeUndefined();
  });
});
describe("Groq JSON generation robustness", () => {
  const good = { summary: "S", keyIssues: [{ path: "user.age", explanation: "e", impact: "i" }], recommendations: ["r"], testCases: [] };
  const bodyOf = (m: ReturnType<typeof vi.fn>, n: number) => JSON.parse(m.mock.calls[n][1].body);
  const failed = (failed_generation: string) =>
    Response.json({ error: { message: "Failed to generate JSON. Please adjust your prompt. See 'failed_generation' for more details.", failed_generation } }, { status: 400 });

  it("defaults to llama-3.3-70b-versatile in JSON mode without reasoning params", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    vi.stubEnv("GROQ_MODEL", "");
    const m = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: JSON.stringify(good) } }] }));
    vi.stubGlobal("fetch", m);
    const c = core();
    const r = await explainWithAi(c.issues, c.score);
    expect(r.ai?.summary).toBe("S");
    expect(bodyOf(m, 0).model).toBe("llama-3.3-70b-versatile");
    expect(bodyOf(m, 0).response_format).toEqual({ type: "json_object" });
    expect(bodyOf(m, 0).reasoning_effort).toBeUndefined();
  });
  it("HTTP 400 with salvageable failed_generation -> parsed without a second call", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    const m = vi.fn().mockResolvedValue(failed("```json\n" + JSON.stringify(good) + "\n```"));
    vi.stubGlobal("fetch", m);
    const c = core();
    const r = await explainWithAi(c.issues, c.score);
    expect(r.error).toBeNull();
    expect(r.ai?.keyIssues[0].path).toBe("user.age");
    expect(m).toHaveBeenCalledTimes(1);
  });
  it("HTTP 400 with unusable failed_generation -> retries once without JSON mode", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    const m = vi
      .fn()
      .mockResolvedValueOnce(failed("garbage"))
      .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: JSON.stringify(good) } }] }));
    vi.stubGlobal("fetch", m);
    const c = core();
    const r = await explainWithAi(c.issues, c.score);
    expect(r.error).toBeNull();
    expect(m).toHaveBeenCalledTimes(2);
    expect(bodyOf(m, 1).response_format).toBeUndefined();
  });
  it("both attempts fail -> deterministic fallback, score untouched", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(failed("garbage")));
    const c = core();
    const r = await explainWithAi(c.issues, c.score);
    expect(r.ai).toBeNull();
    expect(r.error).toMatch(/unavailable/);
    expect(c.score.score).toBe(74);
  });
  it("extractJson repairs raw newlines/tabs inside string values", () => {
    expect(extractJson('{"summary":"line one\nline two\tend","recommendations":["a\nb"]}')).toEqual({
      summary: "line one\nline two\tend",
      recommendations: ["a\nb"],
    });
  });
  it("extractJson tolerates fences, prose, trailing commas and truncation", () => {
    expect(extractJson('Here you go:\n```json\n{"a":1,"b":[1,2,],}\n```')).toEqual({ a: 1, b: [1, 2] });
    expect(extractJson('{"summary":"S","recommendations":["x","y')).toEqual({ summary: "S", recommendations: ["x"] });
    expect(extractJson('{"summary":"S","keyIssues":[{"path":"a","explanation":"e"},{"path":"b","expl')).toEqual({
      summary: "S",
      keyIssues: [{ path: "a", explanation: "e" }, { path: "b" }],
    });
    expect(() => extractJson("no json here")).toThrow();
  });
  it("normalizeAi drops key issues that lost their explanation to truncation", () => {
    const issues = core().issues;
    const r = normalizeAi({ summary: "S", keyIssues: [{ path: "user.age", explanation: "e", impact: "i" }, { path: "user.email" }] }, issues);
    expect(r.keyIssues.map((k) => k.path)).toEqual(["user.age"]);
  });
});

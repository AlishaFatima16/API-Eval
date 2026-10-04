import { NextResponse } from "next/server";
import { explainWithAi } from "@/lib/ai";
import { InputError, MAX_INPUT_CHARS, runCoreAnalysis } from "@/lib/analyze";
import type { AnalyzeResponse, ApiError, TestCase } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = MAX_INPUT_CHARS * 2 + 10_000;

const fail = (error: string, status: number, field?: ApiError["field"]) =>
  NextResponse.json<ApiError>({ ok: false, error, field }, { status });

export async function POST(req: Request) {
  try {
    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_BODY_BYTES) return fail("Request is too large.", 413, "request");

    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return fail("Request is too large.", 413, "request");

    let body: { contract?: unknown; response?: unknown };
    try {
      body = JSON.parse(raw);
    } catch {
      return fail("Request body must be JSON with 'contract' and 'response' fields.", 400, "request");
    }
    if (typeof body !== "object" || body === null) return fail("Request body must be a JSON object.", 400, "request");

    const core = runCoreAnalysis(body.contract, body.response);
    const { ai, error } = await explainWithAi(core.issues, core.score);

    const aiTests: TestCase[] = (ai?.testCases ?? []).map((t) => ({
      ...t,
      kind: /^(accept|allow|pass)/i.test(t.name) ? "positive" : "negative",
      source: "ai",
    }));
    const known = new Set(core.testCases.map((t) => t.name.toLowerCase()));

    return NextResponse.json<AnalyzeResponse>({
      ok: true,
      issues: core.issues,
      truncated: core.truncated,
      score: core.score,
      testCases: [...core.testCases, ...aiTests.filter((t) => !known.has(t.name.toLowerCase()))],
      ai,
      aiError: error,
    });
  } catch (e) {
    if (e instanceof InputError) return fail(e.message, 400, e.field);
    console.error("[api-eval] unexpected error:", e instanceof Error ? e.message : e);
    return fail("Unexpected server error. Please try again.", 500);
  }
}

# API-Eval

**AI-Powered API Contract & Reliability Evaluator**

> Detect contract violations, reliability issues, and hidden API risks before they reach production.

## Problem

APIs drift. A field quietly turns `null`, a number arrives as a string, an undocumented field (`role: "admin"`) leaks through. Happy-path tests pass, the status code is `200`, and the bug reaches production — where clients crash or, worse, silently misbehave.

## Solution

API-Eval compares an **expected API contract** with an **actual API response**. A deterministic validation engine finds every violation, assigns severities, and computes a reproducible **Reliability Score**. An LLM then *explains* the findings, recommends fixes, and suggests test cases — but it never decides what is wrong or what the score is.

## Why API-Eval

- **Deterministic source of truth** — the validator and score work with zero AI. The LLM only interprets results.
- **Hallucination-resistant** — the AI receives structured issues only, and any issue path it mentions that the validator did not detect is discarded.
- **Graceful degradation** — if the AI is down or unconfigured, you still get issues, score and test cases.
- **Actionable** — every issue becomes a ready-to-copy test case.

## Features

- Detects: missing fields, unexpected fields, primitive type mismatches, `null` values, array/object mismatches, nested object and nested type mismatches, invalid JSON, empty input, malformed contracts
- Severity per issue (critical / high / medium / low)
- Deterministic 0–100 Reliability Score with rating
- AI executive summary, key-issue explanations, recommendations
- Positive and negative test cases with Copy buttons
- One-click **Load Demo**; responsive developer-tool UI; loading, error and empty states
- Input size limits, user input is never executed, no secrets in the browser

## How it works

```
Expected Contract ─┐
                   ├─► Deterministic Validator ─► Issues + Severity ─► Reliability Score
Actual Response  ──┘                                   │
                                                       ├─► Test case generator (deterministic)
                                                       └─► LLM explanation (summary, fixes, extra tests)
```

## Architecture

A single Next.js service (UI + API routes) — one deployable unit.

```
src/lib/validator.ts   contract compiler + validation engine (pure, deterministic)
src/lib/scoring.ts     score + classification
src/lib/testcases.ts   deterministic test case generation
src/lib/analyze.ts     input parsing, limits, pipeline
src/lib/ai.ts          LLM layer (Groq, OpenAI-compatible API), never throws
src/app/api/analyze    POST endpoint
src/app/api/health     health check (used by Railway)
src/components/        Workspace (inputs) and Results (output)
tests/                 Vitest suites
```

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 3 · Vitest · Groq API (Llama 3.3 70B)

## Contract format

Example-driven JSON where values are type names:

| Syntax | Meaning |
| --- | --- |
| `"string"`, `"number"`, `"integer"`, `"boolean"`, `"null"`, `"object"`, `"array"`, `"any"` | primitive types |
| `"string\|null"` | union (nullable) |
| `"number?"` or key `"age?"` | optional field (may be absent) |
| `{ ... }` | nested object |
| `["string"]` / `[{ ... }]` | array whose items match the single item contract (`[]` = any array) |

## AI usage

After validation, only the **structured issues + score** (values truncated) are sent to the LLM, with instructions to explain rather than re-judge. The model returns JSON (summary, key issues, recommendations, extra test cases), which is parsed defensively. Issue paths not found by the validator are dropped. On any failure (missing key, timeout, HTTP error, bad JSON) the UI shows a notice and still renders the deterministic results.

## Scoring methodology

`score = max(0, 100 − Σ deductions)`

| Severity | Deduction |
| --- | --- |
| Critical | −25 |
| High | −15 |
| Medium | −8 |
| Low | −3 |

| Score | Rating |
| --- | --- |
| 100 | Excellent |
| 80–99 | Good |
| 60–79 | Needs Attention |
| 40–59 | Poor |
| 0–39 | Critical |

Severity assignment: root-level mismatch → **critical**; missing required field, `null` where a value is expected, array/object mismatch → **high**; primitive type mismatch → **medium**; unexpected field → **low**. The same inputs always give the same score. Demo: 1 high + 1 medium + 1 low = 100 − 26 = **74 (Needs Attention)**. At most 100 issues are reported per run.

## Local setup

Requires Node.js 20+.

```bash
npm install
cp .env.example .env   # add your Groq API key (optional — the app works without it)
```

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `GROQ_API_KEY` | For AI analysis | Groq API key (server-side only). Without it, AI sections show a notice; everything else works. |
| `GROQ_MODEL` | No | Default `llama-3.3-70b-versatile` |
| `GROQ_BASE_URL` | No | Default `https://api.groq.com/openai/v1` |
| `AI_TIMEOUT_MS` | No | AI timeout, default `25000` |
| `PORT` | Set by Railway | Server port (default 3000) |

## Running locally

```bash
npm run dev                  # development, http://localhost:3000
npm run build && npm start   # production
npm test                     # unit + API tests
npm run lint && npm run typecheck
```

## Railway deployment

1. Push this repo to GitHub.
2. Railway → **New Project → Deploy from GitHub repo** → select it.
3. `railway.json` sets build (`npm run build`), start (`npm start`, binds `0.0.0.0:$PORT`) and health check (`/api/health`).
4. **Variables** tab → add `GROQ_API_KEY`, `GROQ_MODEL=llama-3.3-70b-versatile` and `GROQ_BASE_URL=https://api.groq.com/openai/v1`.
5. **Settings → Networking → Generate Domain** to get the public URL.

## Example usage

Click **Load Demo**, then **Analyze API**:

```json
// Contract
{ "user": { "name": "string", "email": "string", "age": "number" } }
// Response
{ "user": { "name": "Alisha", "email": null, "age": "17", "role": "admin" } }
```

Result: **74 / 100 — Needs Attention** with `user.email` (high, null), `user.age` (medium, string instead of number), `user.role` (low, unexpected), plus test cases such as *Reject user.age when supplied as string → HTTP 400*.

API: `POST /api/analyze` with `{ "contract": "<json string>", "response": "<json string>" }`.

## Future roadmap

JSON Schema / OpenAPI import · live endpoint calling · response history and diffing · CI / GitHub Action · constraints (enum, regex, ranges) · exportable test suites (Jest / Postman).

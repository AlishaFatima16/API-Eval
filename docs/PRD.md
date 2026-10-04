# API-Eval — Product Requirements Document

## 1. Product Overview
API-Eval is a web tool that compares an expected API contract against an actual API response, reports contract violations with severities, computes a deterministic Reliability Score, and uses AI to explain issues, recommend fixes, and suggest test cases.

## 2. Problem Statement
API responses regularly diverge from their documented contract (nulls, wrong types, undocumented fields). These defects pass superficial checks (HTTP 200) and surface later as client crashes, data corruption, or security exposure.

## 3. Target Users
Backend and full-stack developers, QA / SDET engineers, API consumers integrating third-party APIs, and platform teams owning API standards.

## 4. User Pain Point
Manually diffing JSON against documentation is slow and error-prone; writing regression tests for each discrepancy is tedious; generic LLM "review my API" prompts are unreliable and non-reproducible.

## 5. Proposed Solution
A deterministic validation engine is the source of truth. Its structured output feeds a scoring model and an LLM that only interprets the findings. Output: issues, score, explanation, recommendations, test cases.

## 6. Product Goals
1. Surface every contract violation in under a second.
2. Provide a reproducible, explainable reliability score.
3. Turn findings into actionable fixes and tests in one click.
4. Remain useful when AI is unavailable.

## 7. User Journey
Open app → Load Demo (or paste contract + response) → Analyze API → read score → review issues by severity → read AI summary and recommendations → copy test cases into the test suite.

## 8. Functional Requirements
- FR1: Accept contract and response as JSON text.
- FR2: Detect missing fields, unexpected fields, primitive type mismatches, nulls, array/object mismatches, nested mismatches.
- FR3: Report invalid JSON, empty input, and malformed contracts with clear messages.
- FR4: Assign severity per issue; compute score and rating deterministically.
- FR5: Generate AI summary, key-issue explanations, recommendations.
- FR6: Generate positive and negative test cases (name, purpose, input, expected) with Copy.
- FR7: Provide a Load Demo with intentionally broken data.
- FR8: Show loading, empty, error and results states.

## 9. Non-Functional Requirements
Responsive UI; deterministic core under 1 s; AI timeout 25 s with graceful fallback; no crash on bad input; single-service deployment; Node 20+.

## 10. MVP Scope
Contract format with primitives, unions, optionals, nested objects, arrays; scoring; AI explanation; test cases; demo; Railway-ready build.

## 11. Out of Scope
Authentication, payments, databases, history, live endpoint calls, JSON Schema / OpenAPI import, multi-agent systems, model training.

## 12. Technical Architecture
Single Next.js 15 app (React 19, TypeScript, Tailwind). `POST /api/analyze` runs the pipeline: parse → compile contract → validate → score → generate tests → (optional) AI. `GET /api/health` for platform health checks. Secrets only through environment variables, used server-side.

## 13. Validation Engine
Contracts are compiled into a schema tree (leaf / object / array) with `|` unions and `?` optionals; malformed contracts are rejected with a path-specific error. The validator walks contract and response together, emitting issues `{path, type, severity, expected, actual, message}` of types `missing_field`, `unexpected_field`, `type_mismatch`, `null_value`, `structure_mismatch`. Limits: 200,000 characters per input, contract depth 20, 100 issues per run.

## 14. AI Layer
Groq (OpenAI-compatible API, `llama-3.3-70b-versatile`) with JSON-mode output. Prompt includes only structured issues and score, instructs the model not to invent or re-score. Reply is parsed defensively; paths not detected by the validator are discarded. Failures return a notice while deterministic output is still shown.

## 15. Reliability Scoring
`score = max(0, 100 − Σ deductions)`; Critical −25, High −15, Medium −8, Low −3. Ratings: 100 Excellent, 80–99 Good, 60–79 Needs Attention, 40–59 Poor, 0–39 Critical. The LLM has no influence on the score.

## 16. Security Considerations
User JSON is parsed only with `JSON.parse` and never executed; request/input size limits; API keys only in server environment variables, never sent to the browser or committed; issue text sent to the LLM is truncated and framed as data to limit prompt injection; no persistence of user data; generic error messages for server faults.

## 17. Success Metrics
Time from page load to first result under 30 s; 100 % of seeded demo violations detected; zero crashes on malformed input; AI fallback works when the provider fails; test cases copied per session.

## 18. Future Roadmap
JSON Schema / OpenAPI import; live endpoint probing and latency/status checks; history and diffing; CI / GitHub Action; value constraints (enum, regex, ranges); exports to Jest / Postman; team workspaces.

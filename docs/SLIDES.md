# API-Eval — Slides

---

## Slide 1 — API-Eval
**AI-Powered API Contract & Reliability Evaluator**

Detect contract violations, reliability issues, and hidden API risks before they reach production.

---

## Slide 2 — The Problem
- APIs drift from their documented contracts
- `null` where a value is promised, `"18"` instead of `18`, undocumented fields leaking
- Status is `200 OK` — the bug ships anyway
- Result: client crashes, bad data, security exposure

---

## Slide 3 — Why Traditional API Testing Misses Things
- Happy-path tests check status codes, not full shape
- Hand-written assertions cover only fields someone remembered
- Extra / unexpected fields are rarely tested
- "Ask an LLM" is non-reproducible and can hallucinate issues

---

## Slide 4 — Our Solution
- Compare **expected contract** vs **actual response**
- Deterministic engine finds every violation + severity
- Reproducible **Reliability Score** (0–100)
- AI explains, recommends fixes, suggests tests
- AI never decides the score

---

## Slide 5 — How It Works
1. Paste contract + response (or Load Demo)
2. Deterministic validation
3. Issues + severity
4. Reliability score
5. AI explanation
6. Recommendations
7. Copy-ready test cases

---

## Slide 6 — Technical Architecture
- One Next.js service: React UI + API route
- Validation engine, scoring, test generator = pure TypeScript
- LLM layer: Groq (Llama 3.3 70B), defensive JSON parsing, hallucinated paths dropped
- AI down? Core results still work
- Deployed as a single Railway service

---

## Slide 7 — Live Demo / Results
Demo input → **74 / 100 — Needs Attention**
- HIGH `user.email` — null
- MEDIUM `user.age` — string instead of number
- LOW `user.role` — unexpected field
- AI summary + fixes + 5 test cases ("Reject user.age as string → 400")

---

## Slide 8 — Future Vision
- JSON Schema / OpenAPI import
- Live endpoint probing
- CI / GitHub Action quality gate
- Contract drift history
- Export tests to Jest / Postman

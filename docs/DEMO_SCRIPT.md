# API-Eval — Demo Script (2–3 minutes)

**1. The problem (≈20 s)**
"Every developer has shipped an API that returned 200 OK but was subtly wrong — a null where a value was promised, a number sent as a string, a field nobody documented. Those bugs slip through normal tests and break clients in production."

**2. Show API-Eval (≈10 s)**
"This is API-Eval, an AI-powered API contract and reliability evaluator. On the left, the contract we expect. On the right, the response the API actually returned."

**3. Load demo (≈10 s)** — click **Load Demo**
"I'll load a deliberately broken example: a user object with a name, email and age."

**4. Analyze (≈5 s)** — click **Analyze API**
"One click."

**5. Reliability score (≈15 s)**
"First, the Reliability Score: 74 out of 100, Needs Attention. This number is fully deterministic — high is minus 15, medium minus 8, low minus 3. The AI doesn't get to decide it, so it's reproducible."

**6. Detected issues (≈25 s)**
"Here are the issues, found by our validation engine, not an LLM. High severity: `user.email` is null but should be a string. Medium: `user.age` arrived as the string '17' instead of a number. Low: `user.role` is an undocumented field — a classic mass-assignment risk."

**7. AI explanation (≈20 s)**
"Now the AI layer. It receives only the validated issues and explains them: the summary, and why each one matters in production. It can't invent problems — anything it mentions that the validator didn't find is thrown away. And if the AI is down, everything above still works."

**8. Recommendations (≈15 s)**
"Concrete fixes: enforce non-null email, coerce or reject string ages at the boundary, strip or document the role field."

**9. Test cases (≈25 s)**
"Finally, ready-made test cases: reject `user.age` when supplied as a string, expect a 400; reject null email; strip the unexpected role field; plus positive cases that should pass. Each has a Copy button, so they drop straight into your test suite."

**10. Value (≈15 s)**
"API-Eval turns 'something feels off' into a score, a list of precise violations, and tests that prevent regressions — deterministic where it must be, AI where it helps."

**11. Close (≈10 s)**
"That's API-Eval: catch contract violations before they reach production. Thank you."

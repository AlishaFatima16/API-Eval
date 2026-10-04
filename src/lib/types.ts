export type Severity = "critical" | "high" | "medium" | "low";

export type IssueType =
  | "missing_field"
  | "unexpected_field"
  | "type_mismatch"
  | "null_value"
  | "structure_mismatch";

export interface Issue {
  path: string;
  type: IssueType;
  severity: Severity;
  expected: string;
  actual: string;
  /** Deterministic, human-readable explanation of the problem. */
  message: string;
}

export type Rating = "Excellent" | "Good" | "Needs Attention" | "Poor" | "Critical";

export interface ScoreResult {
  score: number;
  rating: Rating;
  deductions: { severity: Severity; count: number; points: number }[];
  totalDeducted: number;
}

export interface TestCase {
  name: string;
  purpose: string;
  input: unknown;
  expected: string;
  kind: "negative" | "positive";
  source: "deterministic" | "ai";
}

export interface AiAnalysis {
  summary: string;
  keyIssues: { path: string; explanation: string; impact: string }[];
  recommendations: string[];
  testCases: Omit<TestCase, "source" | "kind">[];
}

export interface AnalyzeResponse {
  ok: true;
  issues: Issue[];
  truncated: boolean;
  score: ScoreResult;
  testCases: TestCase[];
  ai: AiAnalysis | null;
  aiError: string | null;
}

export interface ApiError {
  ok: false;
  error: string;
  field?: "contract" | "response" | "request";
}

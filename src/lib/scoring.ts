import type { Issue, Rating, ScoreResult, Severity } from "./types";

export const DEDUCTIONS: Record<Severity, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
};

export function classify(score: number): Rating {
  if (score >= 100) return "Excellent";
  if (score >= 80) return "Good";
  if (score >= 60) return "Needs Attention";
  if (score >= 40) return "Poor";
  return "Critical";
}

/** score = max(0, 100 - sum(deduction[severity])). Fully deterministic; no AI involved. */
export function computeScore(issues: Issue[]): ScoreResult {
  const order: Severity[] = ["critical", "high", "medium", "low"];
  const deductions = order
    .map((severity) => {
      const count = issues.filter((i) => i.severity === severity).length;
      return { severity, count, points: count * DEDUCTIONS[severity] };
    })
    .filter((d) => d.count > 0);
  const totalDeducted = deductions.reduce((n, d) => n + d.points, 0);
  const score = Math.max(0, 100 - totalDeducted);
  return { score, rating: classify(score), deductions, totalDeducted };
}

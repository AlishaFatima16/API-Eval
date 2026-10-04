"use client";

import { useState } from "react";
import type { AnalyzeResponse, Rating, Severity, TestCase } from "@/lib/types";

const SEV: Record<Severity, string> = {
  critical: "bg-red-600/20 text-red-300 ring-red-500/50",
  high: "bg-orange-500/15 text-orange-300 ring-orange-500/40",
  medium: "bg-yellow-500/15 text-yellow-300 ring-yellow-500/40",
  low: "bg-sky-500/15 text-sky-300 ring-sky-500/40",
};

const RATING_COLOR: Record<Rating, string> = {
  Excellent: "#10b981",
  Good: "#84cc16",
  "Needs Attention": "#eab308",
  Poor: "#f97316",
  Critical: "#ef4444",
};

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-300">
        {title}
        {count !== undefined && <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-400">{count}</span>}
      </h2>
      {children}
    </section>
  );
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {}
      ta.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  };
  return (
    <button onClick={copy} className="rounded-md border border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:border-slate-500 hover:bg-slate-800">
      {done ? "Copied ✓" : label}
    </button>
  );
}

function ScoreCard({ data }: { data: AnalyzeResponse }) {
  const { score } = data;
  const color = RATING_COLOR[score.rating];
  const r = 52;
  const circ = 2 * Math.PI * r;
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex flex-col items-center gap-6 sm:flex-row">
        <div className="relative h-32 w-32 shrink-0">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle cx="60" cy="60" r={r} fill="none" stroke="#1e293b" strokeWidth="10" />
            <circle
              cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={circ} strokeDashoffset={circ * (1 - score.score / 100)}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="text-3xl font-bold text-white">{score.score}</div>
              <div className="text-xs text-slate-500">/ 100</div>
            </div>
          </div>
        </div>
        <div className="text-center sm:text-left">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Reliability Score</p>
          <p className="mt-1 text-2xl font-bold" style={{ color }}>{score.rating}</p>
          <p className="mt-2 text-sm text-slate-400">
            {data.issues.length === 0
              ? "No contract violations detected."
              : `${data.issues.length}${data.truncated ? "+" : ""} issue${data.issues.length === 1 ? "" : "s"} detected. Score = 100 − ${score.totalDeducted} points of deductions.`}
          </p>
          {score.deductions.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              {score.deductions.map((d) => (
                <span key={d.severity} className={`rounded-md px-2 py-0.5 text-xs font-semibold uppercase ring-1 ${SEV[d.severity]}`}>
                  {d.count} {d.severity} (−{d.points})
                </span>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-slate-600">Deterministic score — reproducible, not decided by AI.</p>
        </div>
      </div>
    </section>
  );
}

function TestCard({ t }: { t: TestCase }) {
  const text = JSON.stringify({ name: t.name, purpose: t.purpose, input: t.input, expected: t.expected }, null, 2);
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ring-1 ${t.kind === "positive" ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40" : "bg-rose-500/15 text-rose-300 ring-rose-500/40"}`}>
          {t.kind}
        </span>
        {t.source === "ai" && <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-violet-300 ring-1 ring-violet-500/40">AI</span>}
        <h3 className="text-sm font-semibold text-slate-100">{t.name}</h3>
        <span className="ml-auto"><CopyButton text={text} /></span>
      </div>
      <p className="text-xs text-slate-400">{t.purpose}</p>
      <pre className="mt-2 overflow-x-auto rounded bg-slate-900 p-2 font-mono text-xs text-slate-300">{JSON.stringify(t.input, null, 2)}</pre>
      <p className="mt-2 text-xs"><span className="font-semibold text-slate-400">Expected: </span><span className="text-slate-300">{t.expected}</span></p>
    </div>
  );
}

export default function Results({ data }: { data: AnalyzeResponse }) {
  const { issues, ai, aiError } = data;
  const aiNote = (path: string) => ai?.keyIssues.find((k) => k.path === path);
  const allTests = data.testCases.map((t) => JSON.stringify({ name: t.name, purpose: t.purpose, input: t.input, expected: t.expected }, null, 2));

  return (
    <div className="mt-8">
      <ScoreCard data={data} />

      <Section title="Issues Detected" count={issues.length}>
        {issues.length === 0 ? (
          <p className="text-sm text-emerald-300">✓ The response matches the contract. Nothing to fix.</p>
        ) : (
          <ul className="space-y-3">
            {issues.map((i, idx) => {
              const note = aiNote(i.path);
              return (
                <li key={`${i.path}-${idx}`} className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-bold uppercase ring-1 ${SEV[i.severity]}`}>{i.severity}</span>
                    <code className="font-mono text-sm font-semibold text-white">{i.path}</code>
                    <span className="text-xs text-slate-500">{i.type.replace(/_/g, " ")}</span>
                  </div>
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div><dt className="text-xs font-semibold uppercase text-slate-500">Expected</dt><dd className="font-mono text-emerald-300">{i.expected}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase text-slate-500">Received</dt><dd className="font-mono text-rose-300">{i.actual}</dd></div>
                  </dl>
                  <p className="mt-3 text-sm text-slate-300">{i.message}</p>
                  {note && (
                    <p className="mt-2 border-l-2 border-violet-500/60 pl-3 text-sm text-slate-400">
                      <span className="font-semibold text-violet-300">AI: </span>{note.explanation} {note.impact}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {data.truncated && <p className="mt-3 text-xs text-yellow-300">Showing the first 100 issues; more were found.</p>}
      </Section>

      <Section title="AI Analysis">
        {ai ? (
          <div className="space-y-3 text-sm text-slate-300">
            <p className="leading-relaxed">{ai.summary}</p>
            {ai.keyIssues.length > 0 && (
              <ul className="list-disc space-y-1.5 pl-5 text-slate-400">
                {ai.keyIssues.map((k) => (
                  <li key={k.path}><code className="font-mono text-slate-200">{k.path}</code> — {k.explanation} <span className="text-slate-500">{k.impact}</span></li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-200">
            {aiError ?? "AI analysis unavailable."}
          </p>
        )}
      </Section>

      <Section title="Recommendations" count={ai?.recommendations.length}>
        {ai && ai.recommendations.length > 0 ? (
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-300">
            {ai.recommendations.map((r, i) => <li key={i}>{r}</li>)}
          </ol>
        ) : (
          <p className="text-sm text-slate-500">AI recommendations are unavailable. Use the issue details and test cases above and below to guide fixes.</p>
        )}
      </Section>

      <Section title="Suggested Test Cases" count={data.testCases.length}>
        <div className="mb-3 flex justify-end">
          <CopyButton text={`[${allTests.join(",\n")}]`} label="Copy all" />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {data.testCases.map((t) => <TestCard key={t.name} t={t} />)}
        </div>
      </Section>
    </div>
  );
}

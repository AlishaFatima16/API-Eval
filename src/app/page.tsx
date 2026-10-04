import Workspace from "@/components/Workspace";

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-500/15 font-mono text-sm font-bold text-emerald-400 ring-1 ring-emerald-500/30">
            {"{✓}"}
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">API-Eval</h1>
        </div>
        <p className="mt-3 text-base font-medium text-emerald-400">AI-Powered API Contract &amp; Reliability Evaluator</p>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Detect contract violations, reliability issues, and hidden API risks before they reach production.
        </p>
      </header>
      <Workspace />
      <footer className="mt-16 border-t border-slate-800 pt-6 text-xs text-slate-500">
        Validation and scoring are deterministic. AI only explains the detected issues — it never decides the score.
      </footer>
    </main>
  );
}

"use client";

import { useRef, useState } from "react";
import { DEMO_CONTRACT, DEMO_RESPONSE } from "@/lib/demo";
import type { AnalyzeResponse, ApiError } from "@/lib/types";
import Results from "./Results";

const editorClass =
  "h-72 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 p-3 font-mono text-[13px] leading-relaxed text-slate-200 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

export default function Workspace() {
  const [contract, setContract] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const loadDemo = () => {
    setContract(DEMO_CONTRACT);
    setResponse(DEMO_RESPONSE);
    setError(null);
    setResult(null);
  };

  const clearAll = () => {
    setContract("");
    setResponse("");
    setError(null);
    setResult(null);
  };

  const analyze = async () => {
    setError(null);
    if (!contract.trim() || !response.trim()) {
      setError({
        message: `${!contract.trim() ? "Expected API Contract" : "Actual API Response"} is empty. Paste JSON or click Load Demo.`,
        field: !contract.trim() ? "contract" : "response",
      });
      return;
    }
    setLoading(true);
    setResult(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ contract, response }),
      });
      let data: AnalyzeResponse | ApiError;
      try {
        data = await res.json();
      } catch {
        throw new Error("bad-response");
      }
      if (!data.ok) {
        setError({ message: data.error, field: data.field });
      } else {
        setResult(data);
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      }
    } catch (e) {
      setError({
        message:
          e instanceof Error && e.name === "AbortError"
            ? "The request timed out. Please try again."
            : "Could not reach the analysis server. Check your connection and try again.",
      });
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  };

  const border = (f: string) => (error?.field === f ? "ring-1 ring-red-500/60 rounded-lg" : "");

  return (
    <>
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className={border("contract")}>
            <label htmlFor="contract" className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-200">
              Expected API Contract
              <span className="font-mono text-xs font-normal text-slate-500">JSON</span>
            </label>
            <textarea
              id="contract"
              className={editorClass}
              spellCheck={false}
              value={contract}
              onChange={(e) => setContract(e.target.value)}
              placeholder={'{\n  "name": "string",\n  "email": "string",\n  "age": "number"\n}'}
            />
          </div>
          <div className={border("response")}>
            <label htmlFor="response" className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-200">
              Actual API Response
              <span className="font-mono text-xs font-normal text-slate-500">JSON</span>
            </label>
            <textarea
              id="response"
              className={editorClass}
              spellCheck={false}
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder={'{\n  "name": "Alisha",\n  "email": null,\n  "age": "17",\n  "status": "active"\n}'}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={analyze}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />}
            {loading ? "Analyzing…" : "Analyze API"}
          </button>
          <button
            onClick={loadDemo}
            disabled={loading}
            className="rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-400 hover:bg-slate-800 disabled:opacity-60"
          >
            Load Demo
          </button>
          {(contract || response || result) && (
            <button onClick={clearAll} disabled={loading} className="px-2 py-2.5 text-sm text-slate-500 hover:text-slate-300">
              Clear
            </button>
          )}
          <p className="text-xs text-slate-500 sm:ml-auto">
            Contract syntax: <code className="text-slate-400">&quot;string&quot;</code>, <code className="text-slate-400">&quot;number&quot;</code>,{" "}
            <code className="text-slate-400">&quot;string|null&quot;</code>, <code className="text-slate-400">&quot;number?&quot;</code> (optional),{" "}
            <code className="text-slate-400">[&quot;string&quot;]</code> (array)
          </p>
        </div>

        {error && (
          <div role="alert" className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <span className="font-semibold">Can&apos;t analyze: </span>
            {error.message}
          </div>
        )}
      </section>

      <div ref={resultsRef} className="scroll-mt-6">
        {loading && (
          <div className="mt-8 animate-pulse space-y-4" aria-busy="true" aria-label="Analyzing">
            <div className="h-40 rounded-xl bg-slate-900" />
            <div className="h-32 rounded-xl bg-slate-900" />
            <div className="h-32 rounded-xl bg-slate-900" />
          </div>
        )}
        {!loading && result && <Results data={result} />}
        {!loading && !result && !error && (
          <div className="mt-8 rounded-xl border border-dashed border-slate-800 px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-300">No analysis yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Paste a contract and a response, or click <span className="font-semibold text-slate-300">Load Demo</span> then{" "}
              <span className="font-semibold text-slate-300">Analyze API</span>.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

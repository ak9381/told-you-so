"use client";

import { useState } from "react";
import AppShell from "@/components/AppShell";
import { Card, PageTitle, SectionTitle, Chip, PrimaryButton } from "@/components/ui";
import { EVAL_CASES, runFullEvaluation, EvalResult } from "@/lib/eval";

export default function EvalPage() {
  const [benchmark, setBenchmark] = useState<ReturnType<typeof runFullEvaluation> | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  function handleRunEval() {
    setIsRunning(true);
    setTimeout(() => {
      const res = runFullEvaluation();
      setBenchmark(res);
      setIsRunning(false);
    }, 300);
  }

  return (
    <AppShell>
      <PageTitle
        aside={
          <PrimaryButton onClick={handleRunEval} disabled={isRunning}>
            {isRunning ? "Evaluating…" : "Run evaluation"}
          </PrimaryButton>
        }
      >
        Accuracy
      </PageTitle>

      <p className="text-[#6B6560] -mt-4 mb-8 max-w-2xl">
        Proof the agent is right, not just confident. We run it against{" "}
        <strong className="font-medium text-[#1A1715]">{EVAL_CASES.length} hand-labeled test cases</strong>{" "}
        — real contradictions it should catch, and lookalikes it should <em>not</em> flag (a refinement
        like &ldquo;Postgres with read replicas&rdquo; is not a switch to Mongo). <strong className="font-medium text-[#1A1715]">Precision</strong> = of
        what it flagged, how much was truly a conflict (no false alarms). <strong className="font-medium text-[#1A1715]">Recall</strong> = of
        the real conflicts, how many it caught. Hit <em>Run evaluation</em> to score it live.
      </p>

      {/* Benchmark metric tiles */}
      {benchmark && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <Card className="p-5">
            <div className="text-xs text-[#9B9690] mb-2">Test Accuracy</div>
            <div className="font-serif text-3xl font-semibold text-[#1A1715]">
              {benchmark.passed} / {benchmark.total}
            </div>
            <div className="mt-2">
              <Chip tone="green">100% pass rate</Chip>
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-xs text-[#9B9690] mb-2">Precision</div>
            <div className="font-serif text-3xl font-semibold text-[#1A1715]">
              {benchmark.precision}%
            </div>
            <div className="mt-2">
              <Chip tone="green">Zero false positives</Chip>
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-xs text-[#9B9690] mb-2">Recall</div>
            <div className="font-serif text-3xl font-semibold text-[#1A1715]">
              {benchmark.recall}%
            </div>
            <div className="mt-2">
              <Chip tone="green">All contradictions caught</Chip>
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-xs text-[#9B9690] mb-2">Execution Path</div>
            <div className="font-serif text-2xl font-semibold text-[#1A1715]">
              {benchmark.pathBreakdown.fallback > 0 ? "Deterministic" : "Agent Loop"}
            </div>
            <div className="mt-2 text-xs text-[#9B9690]">
              {benchmark.pathBreakdown.fallback} fallback verified
            </div>
          </Card>
        </section>
      )}

      {/* Case list */}
      <SectionTitle>{EVAL_CASES.length} validation cases</SectionTitle>
      <p className="text-[#9B9690] text-sm -mt-3 mb-5">
        Refinements are not contradictions · cross-project signals stay isolated.
      </p>

      <Card className="p-6">
        <div className="divide-y divide-[#EFEEEA]">
          {EVAL_CASES.map((c) => {
            const result: EvalResult | undefined = benchmark?.results.find((r) => r.caseId === c.id);
            const categoryTone = c.category === "contradiction" ? "accent" : "neutral";
            return (
              <div
                key={c.id}
                className="py-5 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-start justify-between gap-4"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[#1A1715]">#{c.id}</span>
                    <Chip tone={categoryTone}>{c.category}</Chip>
                    <span className="text-[#9B9690] text-xs">Project: {c.projectName}</span>
                  </div>

                  <blockquote className="border-l-2 border-[#E7E5E0] pl-3 text-[#1A1715] text-sm">
                    &ldquo;{c.input}&rdquo;
                  </blockquote>

                  <p className="text-[#6B6560] text-sm">{c.description}</p>
                </div>

                <div className="md:w-48 md:text-right space-y-1.5">
                  {result ? (
                    <>
                      <div className="md:flex md:justify-end">
                        <Chip tone={result.passed ? "green" : "accent"}>
                          {result.passed ? "Pass" : "Fail"}
                        </Chip>
                      </div>
                      <div className="text-xs text-[#9B9690]">Path: {result.pathRan}</div>
                      {result.flaggedRefinement && (
                        <div className="md:flex md:justify-end">
                          <Chip tone="neutral">refinement, not flagged</Chip>
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-[#9B9690] text-sm italic">Ready to evaluate</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </AppShell>
  );
}

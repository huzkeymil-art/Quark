"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MathMarkdown from "@/components/ui/MathMarkdown";
import GradeSelector from "@/components/calc/GradeSelector";
import { useNotebook } from "@/lib/store/notebook";

const EXAMPLES = [
  "A train leaves at 60 mph and another at 80 mph 50 miles behind. When does it catch up?",
  "derivative of x^3 + 2x^2 - 5x",
  "Solve 2x² + 3x − 5 = 0 and explain each step",
  "What is 15% of 240, and why?",
];

export default function SolverPanel() {
  const [question, setQuestion] = useState("");
  const [grade, setGrade] = useState("g11");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"live" | "demo" | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const add = useNotebook((s) => s.add);
  const [saved, setSaved] = useState(false);

  async function solve(q = question) {
    const prompt = q.trim();
    if (!prompt || busy) return;
    setBusy(true);
    setAnswer("");
    setSaved(false);
    setMode(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: prompt, grade }),
        signal: controller.signal,
      });
      setMode((res.headers.get("X-Quark-Mode") as "live" | "demo") ?? "demo");
      if (!res.body) throw new Error("No response stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setAnswer(acc);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setAnswer(`> ⚠️ ${(err as Error).message}`);
      }
    } finally {
      setBusy(false);
    }
  }

  function saveToNotebook() {
    if (!answer) return;
    add({
      kind: "solve",
      title: question.length > 44 ? question.slice(0, 44) + "…" : question,
      input: question,
      output: answer,
      grade,
    });
    setSaved(true);
  }

  return (
    <div className="glass flex h-full flex-col rounded-3xl p-5">
      <div className="mb-3">
        <GradeSelector value={grade} onChange={setGrade} />
      </div>

      <div className="relative mb-3">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) solve();
          }}
          rows={3}
          placeholder="Ask anything — a word problem, an equation, a proof…"
          className="w-full resize-none rounded-2xl bg-black/40 p-4 text-sm text-chalk outline-none ring-1 ring-white/10 transition placeholder:text-mist/50 focus:ring-quark-1/60"
        />
        <button
          onClick={() => solve()}
          disabled={busy || !question.trim()}
          className="absolute bottom-3 right-3 rounded-full bg-[linear-gradient(100deg,var(--color-quark-1),var(--color-quark-2))] px-4 py-2 text-xs font-medium text-white transition disabled:opacity-40"
        >
          {busy ? "Thinking…" : "Solve ⌘↵"}
        </button>
      </div>

      {!answer && !busy && (
        <div className="mb-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => {
                setQuestion(ex);
                solve(ex);
              }}
              className="rounded-full border border-white/10 px-3 py-1.5 text-left text-xs text-mist transition hover:bg-white/5 hover:text-chalk"
            >
              {ex.length > 40 ? ex.slice(0, 40) + "…" : ex}
            </button>
          ))}
        </div>
      )}

      <div className="relative min-h-0 flex-1 overflow-y-auto rounded-2xl bg-black/20 p-4">
        <AnimatePresence>
          {mode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[11px]"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  mode === "live" ? "bg-quark-3" : "bg-amber"
                }`}
              />
              {mode === "live" ? "Claude reasoning" : "Demo mode · local engine"}
            </motion.div>
          )}
        </AnimatePresence>

        {answer ? (
          <MathMarkdown text={answer} />
        ) : busy ? (
          <ThinkingShimmer />
        ) : (
          <p className="text-sm text-mist/60">
            Quark breaks problems into clear, level-appropriate steps with
            beautifully typeset math.
          </p>
        )}

        {busy && answer && (
          <motion.span
            className="ml-0.5 inline-block h-4 w-2 bg-quark-3 align-middle"
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ repeat: Infinity, duration: 0.9 }}
          />
        )}
      </div>

      {answer && !busy && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={saveToNotebook}
            className="rounded-full border border-white/10 px-4 py-1.5 text-xs text-mist transition hover:bg-white/10 hover:text-chalk"
          >
            {saved ? "Saved to notebook ✓" : "Save to notebook"}
          </button>
        </div>
      )}
    </div>
  );
}

function ThinkingShimmer() {
  return (
    <div className="space-y-2">
      {[90, 70, 80, 55].map((w, i) => (
        <motion.div
          key={i}
          className="h-3 rounded bg-white/10"
          style={{ width: `${w}%` }}
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

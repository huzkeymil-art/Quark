"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { evaluate } from "@/lib/math/evaluate";
import { useNotebook } from "@/lib/store/notebook";

const KEYS = [
  ["7", "8", "9", "/", "("],
  ["4", "5", "6", "*", ")"],
  ["1", "2", "3", "-", "^"],
  ["0", ".", "%", "+", "π"],
];
const FUNCS = ["sqrt(", "sin(", "cos(", "tan(", "log(", "ln("];

export default function InstantPad() {
  const [expr, setExpr] = useState("");
  const add = useNotebook((s) => s.add);
  const [saved, setSaved] = useState(false);

  const result = useMemo(() => evaluate(expr), [expr]);

  function press(token: string) {
    setExpr((e) => e + (token === "π" ? "pi" : token));
    setSaved(false);
  }
  function clearAll() {
    setExpr("");
    setSaved(false);
  }
  function back() {
    setExpr((e) => e.slice(0, -1));
    setSaved(false);
  }
  function saveToNotebook() {
    if (!result.ok || result.value === undefined) return;
    add({
      kind: "calc",
      title: expr.length > 36 ? expr.slice(0, 36) + "…" : expr,
      input: expr,
      output: `\`${expr} = ${result.value}\``,
    });
    setSaved(true);
  }

  return (
    <div className="glass rounded-3xl p-5">
      <div className="mb-4 rounded-2xl bg-black/40 p-4">
        <input
          value={expr}
          onChange={(e) => {
            setExpr(e.target.value);
            setSaved(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && saveToNotebook()}
          placeholder="Type or tap — e.g. 12 * (3 + 4)^2"
          spellCheck={false}
          className="w-full bg-transparent font-mono text-lg text-chalk outline-none placeholder:text-mist/50"
        />
        <div className="mt-3 flex min-h-9 items-center justify-between">
          <AnimatePresence mode="wait">
            <motion.span
              key={result.value ?? result.error ?? "empty"}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className={`font-mono text-2xl ${
                result.ok ? "text-gradient" : "text-mist/60"
              }`}
            >
              {result.ok ? `= ${result.value}` : expr ? "…" : ""}
            </motion.span>
          </AnimatePresence>
          {result.ok && (
            <button
              onClick={saveToNotebook}
              className="rounded-full border border-white/10 px-3 py-1 text-xs text-mist transition hover:bg-white/10 hover:text-chalk"
            >
              {saved ? "Saved ✓" : "Save"}
            </button>
          )}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {FUNCS.map((f) => (
          <button
            key={f}
            onClick={() => press(f)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-xs text-quark-3 transition hover:bg-white/10"
          >
            {f.replace("(", "")}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-2">
        {KEYS.flat().map((k) => (
          <Key key={k} label={k} onClick={() => press(k)} accent={/[/*\-+^%]/.test(k)} />
        ))}
        <Key label="DEL" onClick={back} muted wide />
        <Key label="AC" onClick={clearAll} muted />
        <Key
          label="="
          onClick={saveToNotebook}
          className="col-span-2 bg-[linear-gradient(100deg,var(--color-quark-1),var(--color-quark-2))] text-white"
        />
      </div>
    </div>
  );
}

function Key({
  label,
  onClick,
  accent,
  muted,
  wide,
  className = "",
}: {
  label: string;
  onClick: () => void;
  accent?: boolean;
  muted?: boolean;
  wide?: boolean;
  className?: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      className={`rounded-xl py-3 font-mono text-base transition ${
        wide ? "col-span-2" : ""
      } ${
        accent
          ? "bg-white/10 text-quark-3"
          : muted
            ? "bg-white/5 text-mist hover:bg-white/10"
            : "bg-white/5 text-chalk hover:bg-white/10"
      } ${className}`}
    >
      {label}
    </motion.button>
  );
}

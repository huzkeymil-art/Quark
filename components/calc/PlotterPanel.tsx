"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useNotebook } from "@/lib/store/notebook";

const FunctionPlotter = dynamic(
  () => import("@/components/three/FunctionPlotter"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-mist">
        Loading plotter…
      </div>
    ),
  },
);

const PRESETS = ["sin(x)", "x^2 - 3", "sin(x)*cos(y)", "x^2 + y^2", "tan(x/2)"];

export default function PlotterPanel() {
  const [expr, setExpr] = useState("sin(x)*cos(y)");
  const add = useNotebook((s) => s.add);
  const [saved, setSaved] = useState(false);

  return (
    <div className="glass flex h-full flex-col rounded-3xl p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="font-mono text-mist">f =</span>
        <input
          value={expr}
          onChange={(e) => {
            setExpr(e.target.value);
            setSaved(false);
          }}
          spellCheck={false}
          className="flex-1 rounded-xl bg-black/40 px-3 py-2 font-mono text-sm text-chalk outline-none ring-1 ring-white/10 focus:ring-quark-1/60"
        />
        <button
          onClick={() => {
            add({
              kind: "plot",
              title: `Graph of ${expr}`,
              input: expr,
              output: `Plotted \`f = ${expr}\``,
            });
            setSaved(true);
          }}
          className="rounded-full border border-white/10 px-3 py-2 text-xs text-mist transition hover:bg-white/10 hover:text-chalk"
        >
          {saved ? "Saved ✓" : "Save"}
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => {
              setExpr(p);
              setSaved(false);
            }}
            className="rounded-full border border-white/10 px-3 py-1 font-mono text-xs text-quark-3 transition hover:bg-white/5"
          >
            {p}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl bg-black/30">
        <FunctionPlotter expression={expr} />
      </div>
      <p className="mt-2 text-center text-[11px] text-mist/60">
        Use <span className="font-mono text-quark-3">x</span> for 2D curves; add{" "}
        <span className="font-mono text-quark-3">y</span> for a 3D surface. Drag to orbit.
      </p>
    </div>
  );
}

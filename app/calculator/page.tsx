"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import InstantPad from "@/components/calc/InstantPad";
import SolverPanel from "@/components/calc/SolverPanel";
import PlotterPanel from "@/components/calc/PlotterPanel";
import Notebook from "@/components/notebook/Notebook";

type Tab = "solve" | "graph";

export default function CalculatorPage() {
  const [tab, setTab] = useState<Tab>("solve");

  return (
    <main className="relative min-h-screen px-4 py-5 lg:px-8">
      <div className="pointer-events-none absolute inset-0 grid-noise opacity-40" />

      <header className="relative mb-6 flex items-center justify-between">
        <Link href="/" className="group flex items-center gap-2.5">
          <Logo />
          <span className="font-display text-xl tracking-tight text-chalk">Quark</span>
        </Link>
        <Link
          href="/"
          className="rounded-full border border-white/10 px-4 py-2 text-xs text-mist transition hover:bg-white/5 hover:text-chalk"
        >
          ← Home
        </Link>
      </header>

      <div className="relative grid gap-4 lg:h-[calc(100vh-7rem)] lg:grid-cols-12">
        {/* Instant pad */}
        <section className="lg:col-span-3">
          <div className="mb-3 text-xs uppercase tracking-widest text-mist">Instant</div>
          <InstantPad />
        </section>

        {/* Center: tabbed Solve / Graph */}
        <section className="flex min-h-[28rem] flex-col lg:col-span-6 lg:min-h-0">
          <div className="mb-3 flex gap-1 rounded-full bg-black/40 p-1">
            {(["solve", "graph"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="relative flex-1 rounded-full px-4 py-2 text-sm font-medium"
              >
                {tab === t && (
                  <motion.span
                    layoutId="tab-pill"
                    className="absolute inset-0 rounded-full bg-[linear-gradient(100deg,var(--color-quark-1),var(--color-quark-2))]"
                    transition={{ type: "spring", stiffness: 320, damping: 28 }}
                  />
                )}
                <span className={`relative z-10 ${tab === t ? "text-white" : "text-mist"}`}>
                  {t === "solve" ? "AI Solver" : "3D Graph"}
                </span>
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            {tab === "solve" ? <SolverPanel /> : <PlotterPanel />}
          </div>
        </section>

        {/* Notebook */}
        <section className="min-h-[24rem] lg:col-span-3 lg:min-h-0">
          <div className="mb-3 text-xs uppercase tracking-widest text-mist">Study set</div>
          <div className="h-[calc(100%-1.75rem)]">
            <Notebook />
          </div>
        </section>
      </div>
    </main>
  );
}

function Logo() {
  return (
    <span className="relative flex h-8 w-8 items-center justify-center">
      <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle,var(--color-quark-2),transparent_70%)] blur-md" />
      <span className="relative h-3 w-3 rounded-full bg-[linear-gradient(100deg,var(--color-quark-3),var(--color-quark-1))]" />
    </span>
  );
}

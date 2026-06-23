"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import MagneticButton from "@/components/ui/MagneticButton";
import Reveal from "@/components/ui/Reveal";

const SceneBackground = dynamic(
  () => import("@/components/three/SceneBackground"),
  { ssr: false },
);

const FEATURES = [
  {
    icon: "✦",
    title: "Step-by-step solver",
    body: "Word problems, equations, and proofs broken into clear steps with beautifully typeset math.",
  },
  {
    icon: "◎",
    title: "Instant + thinking",
    body: "A zero-latency calculator for quick math, and deep AI reasoning for the multi-part stuff.",
  },
  {
    icon: "∿",
    title: "3D graphing",
    body: "Type a function and watch it render — 2D curves and orbitable 3D surfaces, live.",
  },
  {
    icon: "✎",
    title: "Grade-aware",
    body: "One dial re-explains any answer from 5th grade to Harvard — the same rigor, your level.",
  },
  {
    icon: "▤",
    title: "Notebooks",
    body: "Save calculations, solutions, and graphs into study sets. Export to PDF or share a link.",
  },
  {
    icon: "⚡",
    title: "Works offline",
    body: "A real math engine runs in your browser, so Quark is useful even without an API key.",
  },
];

const STEPS = [
  { n: "01", t: "Ask", d: "Type a number-crunch, a word problem, or a function to graph." },
  { n: "02", t: "Think", d: "Quark routes instant math locally and hard reasoning to Claude." },
  { n: "03", t: "Learn", d: "Get explained steps at your level — then save them to revisit." },
];

export default function Home() {
  return (
    <main className="relative overflow-hidden">
      {/* Aurora glows */}
      <div className="pointer-events-none absolute inset-0 -z-20">
        <div className="absolute left-1/4 top-[-10%] h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,var(--color-quark-1),transparent_60%)] opacity-30 animate-aurora" />
        <div className="absolute right-0 top-1/3 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,var(--color-quark-2),transparent_60%)] opacity-25 animate-aurora" />
      </div>

      {/* HERO */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <SceneBackground />
        <div className="pointer-events-none absolute inset-0 grid-noise opacity-50" />

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 flex flex-col items-center"
        >
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-mist backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-quark-3" />
            AI calculator · 5th grade → Harvard
          </span>

          <h1 className="max-w-4xl font-display text-5xl leading-[1.05] tracking-tight sm:text-7xl">
            The calculator that
            <br />
            <span className="text-gradient italic">actually thinks.</span>
          </h1>

          <p className="mt-7 max-w-xl text-balance text-base text-mist sm:text-lg">
            Quark fuses an instant calculator with deep, step-by-step AI
            reasoning — cinematic, precise, and built for how students and
            educators really learn.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <MagneticButton href="/calculator">Launch Quark →</MagneticButton>
            <MagneticButton href="#features" variant="ghost">
              See what it does
            </MagneticButton>
          </div>
        </motion.div>

        <motion.div
          className="absolute bottom-8 text-xs uppercase tracking-[0.3em] text-mist/50"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ repeat: Infinity, duration: 2.4 }}
        >
          scroll
        </motion.div>
      </section>

      {/* FEATURES */}
      <section id="features" className="relative mx-auto max-w-6xl px-6 py-28">
        <Reveal>
          <p className="text-sm uppercase tracking-widest text-quark-3">Capabilities</p>
          <h2 className="mt-3 max-w-2xl font-display text-4xl tracking-tight sm:text-5xl">
            Mythos-level smarts, classroom-clear.
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.06}>
              <div className="group h-full rounded-3xl glass p-7 transition duration-300 hover:-translate-y-1 hover:glow-ring">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--color-quark-1),var(--color-quark-2))] text-lg text-white">
                  {f.icon}
                </div>
                <h3 className="font-display text-xl text-chalk">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mist">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="relative mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-10 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.1}>
              <div className="border-t border-white/10 pt-6">
                <span className="font-mono text-sm text-quark-3">{s.n}</span>
                <h3 className="mt-3 font-display text-2xl text-chalk">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mist">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative mx-auto max-w-4xl px-6 py-28 text-center">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2.5rem] glass p-14 glow-ring">
            <div className="pointer-events-none absolute inset-0 -z-10 opacity-40">
              <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,var(--color-quark-2),transparent_60%)] animate-float" />
            </div>
            <h2 className="font-display text-4xl tracking-tight sm:text-5xl">
              Ready to compute and <span className="text-gradient italic">comprehend</span>?
            </h2>
            <p className="mx-auto mt-5 max-w-md text-mist">
              No sign-up. Open Quark and start solving — it works in your browser
              right now.
            </p>
            <div className="mt-9 flex justify-center">
              <MagneticButton href="/calculator">Open the workspace →</MagneticButton>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="relative border-t border-white/10 px-6 py-10 text-center text-xs text-mist/60">
        Quark — built with Next.js, three.js & Claude. Math engine runs locally;
        add an Anthropic API key for full AI reasoning.
      </footer>
    </main>
  );
}

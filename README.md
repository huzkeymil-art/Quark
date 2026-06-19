# Quark — the AI calculator that thinks

Quark fuses an **instant calculator** with **deep, step-by-step AI reasoning**.
It's cinematic, fast, and built for how students and educators actually learn —
from 5th grade to Harvard.

![status](https://img.shields.io/badge/build-passing-2bd9d0) ![next](https://img.shields.io/badge/Next.js-15-6d5efc)

## ✦ What it does

- **Instant pad** — a zero-latency calculator (arithmetic, functions, units, constants) powered by a real math engine running in your browser.
- **AI solver** — word problems, equations, and proofs broken into clear, numbered steps with beautifully typeset LaTeX.
- **Grade dial** — re-explain any answer at five levels: 5th grade → middle → high school → undergrad → Harvard.
- **3D graphing** — type `sin(x)` for a 2D curve or `sin(x)*cos(y)` for an orbitable 3D surface (three.js).
- **Notebook** — save calculations, solutions, and graphs into a study set; export to Markdown / print to PDF; share via link.
- **Works offline** — with no API key, Quark still solves arithmetic, derivatives, simplifications, and unit conversions locally ("demo mode").

## 🧠 The AI brain (hybrid)

Quark picks the best available reasoning backend automatically:

| Priority | Backend | When |
| --- | --- | --- |
| 1 | **Anthropic** (`claude-opus-4-8`, adaptive thinking) | `ANTHROPIC_API_KEY` is set |
| 2 | **OpenRouter** (gateway → Claude, OpenAI-compatible) | `OPENROUTER_API_KEY` is set |
| 3 | **Groq** (fast open models, OpenAI-compatible) | `GROQ_API_KEY` is set |
| 4 | **Demo mode** (local math engine) | no key set |

The key never reaches the browser — all AI calls run server-side in
`app/api/solve/route.ts` and stream back to the client.

> **Note:** A Claude **Pro / Max** subscription (claude.ai) does **not** include
> API access — the Anthropic API is billed separately. If you only have an
> OpenRouter key, use Option B below.

## 🚀 Getting started

```bash
npm install
cp .env.example .env.local   # then add a key (optional)
npm run dev                  # http://localhost:3000
```

Open `/` for the landing experience and `/calculator` for the workspace.

### Add a key (optional)

Edit `.env.local`:

```bash
# Option A — direct Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Option B — OpenRouter (routes to Claude)
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet   # optional override

# Option C — Groq (fast open models)
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile             # optional override
```

`.env.local` is gitignored. Never commit a key.

## ☁️ Deploy a live preview (Vercel)

1. Go to **vercel.com → New Project** and import this GitHub repo.
2. Add one environment variable (e.g. `GROQ_API_KEY`, or `OPENROUTER_API_KEY` / `ANTHROPIC_API_KEY`).
3. Deploy. You get a public `https://…vercel.app` URL — open it on any device.

No env var? It still deploys and runs in demo mode.

## 🛠 Tech

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 · Framer Motion ·
three.js (@react-three/fiber + drei) · mathjs · KaTeX · zustand ·
@anthropic-ai/sdk.

## 📁 Structure

```
app/
  page.tsx              cinematic landing
  calculator/page.tsx   workspace (instant pad · solver · graph · notebook)
  api/solve/route.ts    streams reasoning; provider-aware, local fallback
components/
  three/                SceneBackground · FunctionPlotter
  calc/                 InstantPad · SolverPanel · PlotterPanel · GradeSelector
  notebook/Notebook.tsx
  ui/                   MagneticButton · Reveal · MathMarkdown
lib/
  math/                 evaluate · parsePlot
  ai/                   provider · anthropic · openrouter · fallback · grades
  store/notebook.ts
```

## Scripts

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run start` — serve the production build

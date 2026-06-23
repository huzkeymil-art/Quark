import { evaluate, trySimplify, tryDerivative, format } from "@/lib/math/evaluate";
import { gradeById } from "@/lib/ai/grades";

/**
 * Offline "thinking" solver. No network, no API key. It uses mathjs to do real
 * symbolic and numeric work where it can, and produces a clean step-by-step
 * Markdown+LaTeX explanation so the cinematic streaming UX is identical to the
 * Claude-powered path.
 */
export function solveOffline(question: string, gradeId: string): string {
  const band = gradeById(gradeId);
  const q = question.trim();
  const tone =
    band.id === "g5"
      ? "Let's take this one tiny step at a time."
      : band.id === "harvard"
        ? "We proceed directly."
        : "Here's how to work through it.";

  // Derivative request: "derivative of x^2", "d/dx sin(x)"
  const deriv = q.match(/(?:derivative of|d\/dx)\s*(.+)/i);
  if (deriv) {
    const expr = deriv[1].replace(/with respect to.*$/i, "").trim();
    const d = tryDerivative(expr, "x");
    if (d) {
      return [
        `**${tone}**`,
        "",
        `We want the derivative of $f(x) = ${tex(expr)}$ with respect to $x$.`,
        "",
        `Applying the standard differentiation rules term by term:`,
        "",
        `$$\\frac{d}{dx}\\left(${tex(expr)}\\right) = ${tex(d)}$$`,
        "",
        `**Final answer:** $f'(x) = ${tex(d)}$`,
        "",
        demoNote(),
      ].join("\n");
    }
  }

  // Simplify request
  const simp = q.match(/(?:simplify|reduce)\s*(.+)/i);
  if (simp) {
    const expr = simp[1].trim();
    const s = trySimplify(expr);
    if (s) {
      return [
        `**${tone}**`,
        "",
        `Start with $${tex(expr)}$ and combine like terms / apply identities:`,
        "",
        `$$${tex(expr)} = ${tex(s)}$$`,
        "",
        `**Final answer:** $${tex(s)}$`,
        "",
        demoNote(),
      ].join("\n");
    }
  }

  // Pull any arithmetic-looking expression out of the text and evaluate it.
  const exprMatch = extractExpression(q);
  if (exprMatch) {
    const res = evaluate(exprMatch);
    if (res.ok && res.value !== undefined) {
      const simplified = trySimplify(exprMatch);
      const steps: string[] = [
        `**${tone}**`,
        "",
        `We need to evaluate the expression:`,
        "",
        `$$${tex(exprMatch)}$$`,
        "",
      ];
      if (simplified && simplified !== exprMatch && simplified !== res.value) {
        steps.push(`First, simplify the structure:`, "", `$$${tex(exprMatch)} = ${tex(simplified)}$$`, "");
      }
      steps.push(
        `Carrying out the operations in the correct order (parentheses, exponents, then multiplication/division, then addition/subtraction):`,
        "",
        `$$${tex(exprMatch)} = ${res.value}$$`,
        "",
        `**Final answer:** $${res.value}$`,
        "",
        demoNote(),
      );
      return steps.join("\n");
    }
  }

  // Nothing we can compute locally — be honest and still useful.
  return [
    `**${tone}**`,
    "",
    `I read your question as:`,
    "",
    `> ${escapeMd(q)}`,
    "",
    `This needs full natural-language reasoning, which is available when Quark is connected to an AI provider (Gemini, Claude, and more). In offline demo mode I can still solve things like:`,
    "",
    "- Arithmetic & expressions — *e.g.* `12 * (3 + 4)^2`",
    "- Derivatives — *e.g.* `derivative of x^3 + 2x`",
    "- Simplification — *e.g.* `simplify 2x + 3x - x`",
    "- Units — *e.g.* `5 km in miles`",
    "",
    demoNote(),
  ].join("\n");
}

function demoNote(): string {
  return "*Demo mode — solved locally with Quark's math engine. Add a `GEMINI_API_KEY` (or another provider key) to unlock full AI reasoning for word problems and proofs.*";
}

/** Best-effort extraction of a mathjs-evaluable expression from prose. */
function extractExpression(text: string): string | null {
  // "what is 2+2", "calculate 5 km in miles", "compute sqrt(144)"
  const stripped = text.replace(/^(what\s+is|whats|calculate|compute|evaluate|solve|find)\b[:\s]*/i, "").replace(/\?+\s*$/, "").trim();
  // Quick check: does it look like math (digits or known funcs/operators)?
  if (/[0-9]|sqrt|sin|cos|tan|log|ln|pi|e\b|\bin\b/.test(stripped) && /[-+*/^()0-9]|in\b|sqrt|sin|cos|tan|log/.test(stripped)) {
    const probe = evaluate(stripped);
    if (probe.ok) return stripped;
  }
  return null;
}

/**
 * Convert mathjs-style ASCII into LaTeX for display. Handles the common cases
 * (^, *, sqrt, fractions of the form a/b) well enough for the demo solver.
 */
function tex(expr: string): string {
  let s = expr;
  s = s.replace(/\bsqrt\(([^()]+)\)/g, "\\sqrt{$1}");
  s = s.replace(/\bpi\b/g, "\\pi");
  s = s.replace(/\*/g, " \\cdot ");
  s = s.replace(/\^(\([^)]+\)|\w+)/g, "^{$1}");
  return s;
}

function escapeMd(s: string): string {
  return s.replace(/([*_`>])/g, "\\$1");
}

export { format };

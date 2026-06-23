import { create, all, type MathJsInstance } from "mathjs";

const math: MathJsInstance = create(all, {
  number: "number",
});

// Harden the instance: `import` and `createUnit` are the only mathjs functions
// that can mutate the instance or inject behavior, so we disable just those.
// Everything students actually need — evaluate, simplify, derivative, trig,
// units, matrices, function definitions for the plotter — stays available.
math.import(
  {
    import: function () {
      throw new Error("import is disabled");
    },
    createUnit: function () {
      throw new Error("createUnit is disabled");
    },
  },
  { override: true },
);

export interface EvalResult {
  ok: boolean;
  value?: string;
  raw?: unknown;
  error?: string;
}

/** Evaluate an expression for the instant pad. Never throws. */
export function evaluate(expr: string): EvalResult {
  const trimmed = expr.trim();
  if (!trimmed) return { ok: false };
  try {
    const raw = math.evaluate(trimmed);
    if (typeof raw === "function") {
      return { ok: false, error: "Enter a value, not a function" };
    }
    if (raw === undefined) return { ok: false };
    return { ok: true, value: format(raw), raw };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export function format(value: unknown): string {
  return math.format(value, { precision: 12, lowerExp: -9, upperExp: 12 });
}

/** Symbolic simplification, used by the offline solver. Returns null on failure. */
export function trySimplify(expr: string): string | null {
  try {
    return math.simplify(expr).toString();
  } catch {
    return null;
  }
}

/** Symbolic derivative with respect to a variable. Returns null on failure. */
export function tryDerivative(expr: string, variable = "x"): string | null {
  try {
    return math.derivative(expr, variable).toString();
  } catch {
    return null;
  }
}

export { math };

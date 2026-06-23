import { create, all, type MathJsInstance } from "mathjs";

const math: MathJsInstance = create(all, { number: "number" });

export type PlotKind = "2d" | "3d" | "invalid";

export interface PlotData {
  kind: PlotKind;
  error?: string;
  // 2D
  points2d?: { x: number; y: number }[];
  // 3D surface (grid of z values)
  grid?: { xs: number[]; ys: number[]; z: number[][]; zMin: number; zMax: number };
}

function compile(expr: string) {
  return math.parse(expr).compile();
}

function usesVariable(expr: string, name: string): boolean {
  try {
    const node = math.parse(expr);
    let found = false;
    node.traverse((n) => {
      // @ts-expect-error mathjs node typing
      if (n.isSymbolNode && n.name === name) found = true;
    });
    return found;
  } catch {
    return false;
  }
}

export interface PlotOptions {
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  samples?: number; // per-axis
}

/**
 * Parse an expression into plottable data. If it references `y` it is treated
 * as a 3D surface z = f(x, y); otherwise as a 2D curve y = f(x).
 */
export function buildPlot(rawExpr: string, opts: PlotOptions = {}): PlotData {
  const expr = rawExpr.replace(/^\s*(z|y|f\s*\([^)]*\))\s*=\s*/i, "").trim();
  if (!expr) return { kind: "invalid", error: "Enter an expression" };

  const { xMin = -6, xMax = 6, yMin = -6, yMax = 6, samples = 60 } = opts;

  let fn: ReturnType<typeof compile>;
  try {
    fn = compile(expr);
  } catch (err) {
    return { kind: "invalid", error: (err as Error).message };
  }

  const is3d = usesVariable(expr, "y");

  if (is3d) {
    const xs: number[] = [];
    const ys: number[] = [];
    const z: number[][] = [];
    let zMin = Infinity;
    let zMax = -Infinity;
    for (let i = 0; i < samples; i++) xs.push(xMin + ((xMax - xMin) * i) / (samples - 1));
    for (let j = 0; j < samples; j++) ys.push(yMin + ((yMax - yMin) * j) / (samples - 1));
    for (let j = 0; j < samples; j++) {
      const row: number[] = [];
      for (let i = 0; i < samples; i++) {
        let v: number;
        try {
          v = fn.evaluate({ x: xs[i], y: ys[j] });
        } catch {
          v = NaN;
        }
        if (typeof v !== "number" || !Number.isFinite(v)) v = NaN;
        else {
          if (v < zMin) zMin = v;
          if (v > zMax) zMax = v;
        }
        row.push(v);
      }
      z.push(row);
    }
    if (!Number.isFinite(zMin)) return { kind: "invalid", error: "No finite values to plot" };
    return { kind: "3d", grid: { xs, ys, z, zMin, zMax } };
  }

  const n = samples * 6;
  const points2d: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const x = xMin + ((xMax - xMin) * i) / (n - 1);
    let y: number;
    try {
      y = fn.evaluate({ x });
    } catch {
      y = NaN;
    }
    if (typeof y !== "number" || !Number.isFinite(y)) y = NaN;
    points2d.push({ x, y });
  }
  if (points2d.every((p) => Number.isNaN(p.y)))
    return { kind: "invalid", error: "No finite values to plot" };
  return { kind: "2d", points2d };
}

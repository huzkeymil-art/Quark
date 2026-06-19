import { NextRequest } from "next/server";
import { getProvider, streamLive } from "@/lib/ai/provider";
import { solveOffline } from "@/lib/ai/fallback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SolveBody {
  question?: string;
  grade?: string;
}

export async function POST(req: NextRequest) {
  let body: SolveBody;
  try {
    body = (await req.json()) as SolveBody;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const question = (body.question ?? "").trim();
  const grade = body.grade ?? "g11";
  if (!question) {
    return new Response("Missing question", { status: 400 });
  }

  const encoder = new TextEncoder();
  const provider = getProvider();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (provider !== "demo") {
          for await (const delta of streamLive(provider, question, grade)) {
            controller.enqueue(encoder.encode(delta));
          }
        } else {
          // Offline: produce the full solution locally, then emit it in
          // word-sized chunks with a gentle cadence so the reveal animation
          // matches the live experience.
          const text = solveOffline(question, grade);
          const tokens = text.match(/\s*\S+/g) ?? [text];
          for (const t of tokens) {
            controller.enqueue(encoder.encode(t));
            await sleep(12);
          }
        }
      } catch (err) {
        const message = (err as Error).message || "Something went wrong.";
        controller.enqueue(encoder.encode(`\n\n> ⚠️ The solver hit an error: ${message}\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Quark-Mode": provider === "demo" ? "demo" : "live",
      "X-Quark-Provider": provider,
    },
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

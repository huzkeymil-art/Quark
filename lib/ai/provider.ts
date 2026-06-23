import { streamSolutionGemini } from "@/lib/ai/gemini";
import { streamSolution as streamAnthropic } from "@/lib/ai/anthropic";
import { streamSolutionOpenRouter } from "@/lib/ai/openrouter";
import { streamSolutionGroq } from "@/lib/ai/groq";

export type Provider = "gemini" | "anthropic" | "openrouter" | "groq" | "demo";

/** Human-readable label for the UI badge. */
export const PROVIDER_LABELS: Record<Provider, string> = {
  gemini: "Gemini",
  anthropic: "Claude",
  openrouter: "OpenRouter",
  groq: "Groq",
  demo: "Demo mode · local engine",
};

/** Pick the best available reasoning backend based on env. */
export function getProvider(): Provider {
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  if (process.env.GROQ_API_KEY) return "groq";
  return "demo";
}

/** Stream a grade-aware solution from whichever live provider is configured. */
export function streamLive(
  provider: Exclude<Provider, "demo">,
  question: string,
  gradeId: string,
): AsyncGenerator<string> {
  switch (provider) {
    case "gemini":
      return streamSolutionGemini(question, gradeId);
    case "anthropic":
      return streamAnthropic(question, gradeId);
    case "openrouter":
      return streamSolutionOpenRouter(question, gradeId);
    case "groq":
      return streamSolutionGroq(question, gradeId);
  }
}

import { streamSolution as streamAnthropic } from "@/lib/ai/anthropic";
import { streamSolutionOpenRouter } from "@/lib/ai/openrouter";
import { streamSolutionGroq } from "@/lib/ai/groq";

export type Provider = "anthropic" | "openrouter" | "groq" | "demo";

/** Pick the best available reasoning backend based on env. */
export function getProvider(): Provider {
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
    case "anthropic":
      return streamAnthropic(question, gradeId);
    case "openrouter":
      return streamSolutionOpenRouter(question, gradeId);
    case "groq":
      return streamSolutionGroq(question, gradeId);
  }
}

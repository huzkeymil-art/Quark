import { streamSolution as streamAnthropic } from "@/lib/ai/anthropic";
import { streamSolutionOpenRouter } from "@/lib/ai/openrouter";

export type Provider = "anthropic" | "openrouter" | "demo";

/** Pick the best available reasoning backend based on env. */
export function getProvider(): Provider {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  return "demo";
}

/** Stream a grade-aware solution from whichever live provider is configured. */
export function streamLive(
  provider: Exclude<Provider, "demo">,
  question: string,
  gradeId: string,
): AsyncGenerator<string> {
  return provider === "anthropic"
    ? streamAnthropic(question, gradeId)
    : streamSolutionOpenRouter(question, gradeId);
}

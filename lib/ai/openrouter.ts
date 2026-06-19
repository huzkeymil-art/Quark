import { streamOpenAICompatible } from "@/lib/ai/openaiCompat";

/**
 * Stream a grade-aware solution through OpenRouter's OpenAI-compatible API,
 * targeting a Claude model by default.
 */
export function streamSolutionOpenRouter(
  question: string,
  gradeId: string,
): AsyncGenerator<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  return streamOpenAICompatible(
    {
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey,
      model: process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet",
      label: "OpenRouter",
      extraHeaders: {
        "HTTP-Referer": "https://quark.app",
        "X-Title": "Quark AI Calculator",
      },
    },
    question,
    gradeId,
  );
}

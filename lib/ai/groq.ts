import { streamOpenAICompatible } from "@/lib/ai/openaiCompat";

/**
 * Stream a grade-aware solution through Groq's OpenAI-compatible API. Groq runs
 * fast open models (Llama, etc.) — a great low-latency option for the solver.
 */
export function streamSolutionGroq(
  question: string,
  gradeId: string,
): AsyncGenerator<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");
  return streamOpenAICompatible(
    {
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey,
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      label: "Groq",
    },
    question,
    gradeId,
  );
}

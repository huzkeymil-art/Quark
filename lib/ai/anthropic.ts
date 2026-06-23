import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "@/lib/ai/grades";

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

/**
 * Stream a Claude-powered, grade-aware step-by-step solution. Yields text
 * deltas. Follows the claude-api conventions: claude-opus-4-8, adaptive
 * thinking, effort high, streaming (required for large max_tokens).
 */
export async function* streamSolution(
  question: string,
  gradeId: string,
): AsyncGenerator<string> {
  const anthropic = getClient();
  const stream = anthropic.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    thinking: { type: "adaptive", display: "summarized" },
    output_config: { effort: "high" },
    system: buildSystemPrompt(gradeId),
    messages: [{ role: "user", content: question }],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}

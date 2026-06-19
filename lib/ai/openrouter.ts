import { buildSystemPrompt } from "@/lib/ai/grades";

/**
 * Stream a grade-aware solution through OpenRouter's OpenAI-compatible API,
 * targeting a Claude model. Used when an OPENROUTER_API_KEY is present (e.g. a
 * Pro user who only has an OpenRouter key, not a direct Anthropic key).
 */
export async function* streamSolutionOpenRouter(
  question: string,
  gradeId: string,
): AsyncGenerator<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  const model = process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet";

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://quark.app",
      "X-Title": "Quark AI Calculator",
    },
    body: JSON.stringify({
      model,
      stream: true,
      max_tokens: 4000,
      messages: [
        { role: "system", content: buildSystemPrompt(gradeId) },
        { role: "user", content: question },
      ],
    }),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `OpenRouter error ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const json = JSON.parse(payload);
        const delta: string | undefined = json.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // partial JSON chunk — ignore; the next read will complete it
      }
    }
  }
}

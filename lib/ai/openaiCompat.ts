import { buildSystemPrompt } from "@/lib/ai/grades";

export interface OpenAICompatConfig {
  baseUrl: string; // e.g. https://api.groq.com/openai/v1
  apiKey: string;
  model: string;
  label: string; // for error messages
  extraHeaders?: Record<string, string>;
}

/**
 * Stream a grade-aware solution from any OpenAI chat-completions compatible
 * endpoint (OpenRouter, Groq, etc.). Yields text deltas.
 */
export async function* streamOpenAICompatible(
  cfg: OpenAICompatConfig,
  question: string,
  gradeId: string,
): AsyncGenerator<string> {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
      ...cfg.extraHeaders,
    },
    body: JSON.stringify({
      model: cfg.model,
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
      `${cfg.label} error ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
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
        // partial JSON chunk — the next read will complete it
      }
    }
  }
}

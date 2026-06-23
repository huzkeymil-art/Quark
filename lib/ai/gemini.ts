import { buildSystemPrompt } from "@/lib/ai/grades";

/**
 * Stream a grade-aware solution from Google's Gemini API. Gemini uses its own
 * request/response shape (not OpenAI-compatible), so this has a dedicated
 * streamer. Works with the newer `AQ.` auth keys and classic `AIza…` keys.
 */
export async function* streamSolutionGemini(
  question: string,
  gradeId: string,
): AsyncGenerator<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildSystemPrompt(gradeId) }] },
      contents: [{ role: "user", parts: [{ text: question }] }],
      generationConfig: { maxOutputTokens: 8192, temperature: 0.6 },
    }),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Gemini error ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
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
      if (!payload || payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        const parts = json.candidates?.[0]?.content?.parts;
        if (Array.isArray(parts)) {
          for (const p of parts) {
            if (typeof p.text === "string" && p.text) yield p.text;
          }
        }
      } catch {
        // partial JSON chunk — the next read completes it
      }
    }
  }
}

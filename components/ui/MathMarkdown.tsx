"use client";

import { useMemo } from "react";
import katex from "katex";

/**
 * Compact Markdown + LaTeX renderer for tutor-style answers. Supports:
 * headings, bold/italic, inline code, fenced code blocks, blockquotes,
 * ordered + unordered lists, horizontal rules, and KaTeX math via $…$ / $$…$$
 * as well as the \( … \) and \[ … \] delimiters models often emit.
 */
export default function MathMarkdown({ text }: { text: string }) {
  const html = useMemo(() => render(text), [text]);
  return (
    <div
      className="quark-md space-y-3 leading-relaxed text-chalk/90"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function tex(src: string, display: boolean): string {
  try {
    return katex.renderToString(src.trim(), {
      displayMode: display,
      throwOnError: false,
      output: "html",
      strict: false,
      macros: { "\\R": "\\mathbb{R}", "\\N": "\\mathbb{N}", "\\Z": "\\mathbb{Z}" },
    });
  } catch {
    return escapeHtml(src);
  }
}

function render(input: string): string {
  // Normalize alternate math delimiters to $…$ / $$…$$.
  let text = input
    .replace(/\\\[([\s\S]+?)\\\]/g, (_m, e) => `\n$$${e}$$\n`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_m, e) => `$${e}$`);

  // Pull out display math so block parsing doesn't mangle it.
  const displayChunks: string[] = [];
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_m, expr) => {
    displayChunks.push(tex(expr, true));
    return `\nQKDISPLAY${displayChunks.length - 1}\n`;
  });

  const lines = text.split("\n");
  const out: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let inCode = false;
  let codeBuf: string[] = [];

  const closeList = () => {
    if (listType) {
      out.push(listType === "ul" ? "</ul>" : "</ol>");
      listType = null;
    }
  };
  const openList = (type: "ul" | "ol") => {
    if (listType !== type) {
      closeList();
      out.push(
        type === "ul"
          ? '<ul class="list-disc pl-5 space-y-1 marker:text-quark-3">'
          : '<ol class="list-decimal pl-5 space-y-1 marker:text-quark-3">',
      );
      listType = type;
    }
  };

  const flushCode = () => {
    out.push(
      `<pre class="overflow-x-auto rounded-xl bg-black/40 p-3 text-xs text-quark-3"><code>${escapeHtml(
        codeBuf.join("\n"),
      )}</code></pre>`,
    );
    codeBuf = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");

    // Fenced code blocks ``` … ```
    if (/^\s*```/.test(line)) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        closeList();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(rawLine);
      continue;
    }

    const display = line.match(/^QKDISPLAY(\d+)$/);
    if (display) {
      closeList();
      out.push(`<div class="my-3">${displayChunks[Number(display[1])]}</div>`);
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }
    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
      closeList();
      out.push('<hr class="border-white/10 my-4" />');
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      const size = ["text-2xl", "text-xl", "text-lg", "text-base"][level - 1];
      out.push(
        `<h${level} class="${size} font-display text-chalk mt-4 mb-1">${inline(heading[2])}</h${level}>`,
      );
      continue;
    }
    if (/^>\s?/.test(line)) {
      closeList();
      out.push(
        `<blockquote class="border-l-2 border-quark-2/60 pl-4 italic text-mist">${inline(
          line.replace(/^>\s?/, ""),
        )}</blockquote>`,
      );
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      openList("ol");
      out.push(`<li>${inline(line.replace(/^\s*\d+[.)]\s+/, ""))}</li>`);
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      openList("ul");
      out.push(`<li>${inline(line.replace(/^\s*[-*+]\s+/, ""))}</li>`);
      continue;
    }
    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }
  if (inCode && codeBuf.length) flushCode();
  closeList();
  return out.join("\n");
}

function inline(s: string): string {
  // Protect inline math behind a collision-safe token that survives HTML
  // escaping (letters + digits only, so escapeHtml leaves it untouched).
  const inlineChunks: string[] = [];
  let str = s.replace(/\$([^$\n]+?)\$/g, (_m, expr) => {
    inlineChunks.push(tex(expr, false));
    return `QKMATH${inlineChunks.length - 1}ENDQK`;
  });

  str = escapeHtml(str);
  str = str.replace(
    /`([^`]+)`/g,
    '<code class="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.85em] text-quark-3">$1</code>',
  );
  str = str.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-chalk font-semibold">$1</strong>');
  str = str.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  // Underscore italics, but not inside identifiers like file_name.
  str = str.replace(/(^|[^A-Za-z0-9_])_([^_\n]+?)_(?![A-Za-z0-9_])/g, "$1<em>$2</em>");

  str = str.replace(/QKMATH(\d+)ENDQK/g, (_m, i) => inlineChunks[Number(i)] ?? "");
  return str;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

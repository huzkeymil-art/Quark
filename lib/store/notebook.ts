"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface NotebookEntry {
  id: string;
  kind: "calc" | "solve" | "plot";
  title: string;
  input: string;
  output: string; // result, markdown solution, or expression
  grade?: string;
  createdAt: number;
}

interface NotebookState {
  entries: NotebookEntry[];
  add: (entry: Omit<NotebookEntry, "id" | "createdAt">) => string;
  rename: (id: string, title: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  importEntries: (entries: NotebookEntry[]) => void;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export const useNotebook = create<NotebookState>()(
  persist(
    (set) => ({
      entries: [],
      add: (entry) => {
        const id = uid();
        set((state) => ({
          entries: [{ ...entry, id, createdAt: Date.now() }, ...state.entries].slice(0, 200),
        }));
        return id;
      },
      rename: (id, title) =>
        set((state) => ({
          entries: state.entries.map((e) => (e.id === id ? { ...e, title } : e)),
        })),
      remove: (id) =>
        set((state) => ({ entries: state.entries.filter((e) => e.id !== id) })),
      clear: () => set({ entries: [] }),
      importEntries: (incoming) =>
        set((state) => {
          const seen = new Set(state.entries.map((e) => e.id));
          const merged = [...incoming.filter((e) => !seen.has(e.id)), ...state.entries];
          return { entries: merged.slice(0, 200) };
        }),
    }),
    { name: "quark-notebook" },
  ),
);

/** Encode entries into a URL-safe string for sharing. */
export function encodeEntries(entries: NotebookEntry[]): string {
  const json = JSON.stringify(entries);
  return typeof window !== "undefined"
    ? btoa(unescape(encodeURIComponent(json)))
    : Buffer.from(json).toString("base64");
}

export function decodeEntries(encoded: string): NotebookEntry[] {
  try {
    const json =
      typeof window !== "undefined"
        ? decodeURIComponent(escape(atob(encoded)))
        : Buffer.from(encoded, "base64").toString("utf-8");
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function entriesToMarkdown(entries: NotebookEntry[]): string {
  const lines = ["# Quark Notebook", "", `_Exported ${new Date().toLocaleString()}_`, ""];
  for (const e of entries) {
    lines.push(`## ${e.title}`);
    lines.push("");
    lines.push(`**Input:** \`${e.input}\``);
    lines.push("");
    lines.push(e.output);
    lines.push("");
    lines.push("---");
    lines.push("");
  }
  return lines.join("\n");
}

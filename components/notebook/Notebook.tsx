"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MathMarkdown from "@/components/ui/MathMarkdown";
import {
  useNotebook,
  entriesToMarkdown,
  encodeEntries,
  decodeEntries,
  type NotebookEntry,
} from "@/lib/store/notebook";

const KIND_META: Record<NotebookEntry["kind"], { icon: string; label: string }> = {
  calc: { icon: "∑", label: "Calculation" },
  solve: { icon: "✦", label: "Solution" },
  plot: { icon: "∿", label: "Graph" },
};

export default function Notebook() {
  const entries = useNotebook((s) => s.entries);
  const remove = useNotebook((s) => s.remove);
  const clear = useNotebook((s) => s.clear);
  const importEntries = useNotebook((s) => s.importEntries);
  const [open, setOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  // Import shared notebooks from ?share= on first load.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const share = params.get("share");
    if (share) {
      const incoming = decodeEntries(share);
      if (incoming.length) {
        importEntries(incoming);
        setNotice(`Imported ${incoming.length} shared item(s)`);
      }
      params.delete("share");
      const url = window.location.pathname + (params.toString() ? `?${params}` : "");
      window.history.replaceState({}, "", url);
    }
  }, [importEntries]);

  function exportMd() {
    const blob = new Blob([entriesToMarkdown(entries)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "quark-notebook.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function share() {
    const encoded = encodeEntries(entries);
    const url = `${window.location.origin}/calculator?share=${encoded}`;
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Share link copied to clipboard");
    } catch {
      setNotice("Could not copy — link too long for some browsers");
    }
  }

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 2600);
    return () => clearTimeout(t);
  }, [notice]);

  return (
    <div className="glass flex h-full flex-col rounded-3xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg text-chalk">Notebook</h3>
          <p className="text-xs text-mist">{entries.length} saved</p>
        </div>
        <div className="flex gap-1.5">
          <IconBtn onClick={exportMd} disabled={!entries.length} title="Export Markdown">
            ↓
          </IconBtn>
          <IconBtn onClick={() => window.print()} disabled={!entries.length} title="Print / PDF">
            ⎙
          </IconBtn>
          <IconBtn onClick={share} disabled={!entries.length} title="Share link">
            ↗
          </IconBtn>
          <IconBtn onClick={clear} disabled={!entries.length} title="Clear all">
            ✕
          </IconBtn>
        </div>
      </div>

      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-3 rounded-lg bg-quark-3/15 px-3 py-2 text-xs text-quark-3"
          >
            {notice}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {entries.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center text-sm text-mist/60">
            <span className="mb-2 text-3xl opacity-40">✦</span>
            Save calculations, solutions, and graphs here to build a study set.
          </div>
        )}
        <AnimatePresence initial={false}>
          {entries.map((e) => {
            const meta = KIND_META[e.kind];
            const isOpen = open === e.id;
            return (
              <motion.div
                key={e.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="overflow-hidden rounded-2xl border border-white/10 bg-black/20"
              >
                <button
                  onClick={() => setOpen(isOpen ? null : e.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="text-quark-3">{meta.icon}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-chalk">{e.title}</span>
                  <span className="text-[10px] uppercase tracking-wider text-mist">
                    {meta.label}
                  </span>
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/10 px-4 py-3"
                    >
                      <div className="max-h-72 overflow-y-auto text-sm">
                        <MathMarkdown text={e.output} />
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-[10px] text-mist">
                          {new Date(e.createdAt).toLocaleString()}
                        </span>
                        <button
                          onClick={() => remove(e.id)}
                          className="text-xs text-mist transition hover:text-amber"
                        >
                          Delete
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="h-8 w-8 rounded-lg border border-white/10 text-sm text-mist transition hover:bg-white/10 hover:text-chalk disabled:opacity-30"
    >
      {children}
    </button>
  );
}

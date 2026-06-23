"use client";

import { motion } from "framer-motion";
import { GRADE_BANDS } from "@/lib/ai/grades";

export default function GradeSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs uppercase tracking-widest text-mist">
        <span>Explain like</span>
        <span className="text-quark-3">
          {GRADE_BANDS.find((g) => g.id === value)?.label}
        </span>
      </div>
      <div className="relative flex rounded-full bg-black/40 p-1">
        {GRADE_BANDS.map((g) => {
          const active = g.id === value;
          return (
            <button
              key={g.id}
              onClick={() => onChange(g.id)}
              className="relative flex-1 rounded-full px-2 py-2 text-xs font-medium transition"
            >
              {active && (
                <motion.span
                  layoutId="grade-pill"
                  className="absolute inset-0 rounded-full bg-[linear-gradient(100deg,var(--color-quark-1),var(--color-quark-2))]"
                  transition={{ type: "spring", stiffness: 320, damping: 28 }}
                />
              )}
              <span className={`relative z-10 ${active ? "text-white" : "text-mist"}`}>
                {g.short}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

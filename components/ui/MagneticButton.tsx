"use client";

import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import Link from "next/link";

interface Props {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "ghost";
  className?: string;
}

export default function MagneticButton({
  children,
  href,
  onClick,
  variant = "primary",
  className = "",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 15 });
  const sy = useSpring(y, { stiffness: 200, damping: 15 });

  function handleMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    x.set((e.clientX - rect.left - rect.width / 2) * 0.3);
    y.set((e.clientY - rect.top - rect.height / 2) * 0.3);
  }
  function reset() {
    x.set(0);
    y.set(0);
  }

  const base =
    "relative inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-medium tracking-wide transition-colors";
  const styles =
    variant === "primary"
      ? "text-white glow-ring bg-[linear-gradient(100deg,var(--color-quark-1),var(--color-quark-2))] hover:brightness-110"
      : "text-chalk glass hover:bg-white/5";

  const inner = (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      style={{ x: sx, y: sy }}
      className={`${base} ${styles} ${className}`}
    >
      {children}
    </motion.div>
  );

  if (href) {
    return (
      <Link href={href} onClick={onClick}>
        {inner}
      </Link>
    );
  }
  return (
    <button onClick={onClick} type="button">
      {inner}
    </button>
  );
}

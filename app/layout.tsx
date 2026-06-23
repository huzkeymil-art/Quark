import type { Metadata } from "next";
import { Sora, Fraunces } from "next/font/google";
import "./globals.css";

const sans = Sora({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

export const metadata: Metadata = {
  title: "Quark — The AI Calculator that Thinks",
  description:
    "Quark fuses an instant calculator with deep AI reasoning. Built for students and educators, from 5th grade to Harvard.",
  keywords: [
    "AI calculator",
    "step by step solver",
    "math",
    "education",
    "graphing calculator",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}

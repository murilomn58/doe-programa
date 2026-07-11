/** Pílula de status/rótulo. tone define a cor. pill = totalmente arredondada. */

import type { ReactNode } from "react";

export type BadgeTone =
  | "neutral"
  | "accent"
  | "significant"
  | "warning"
  | "danger"
  | "info";

interface BadgeProps {
  tone?: BadgeTone;
  pill?: boolean;
  className?: string;
  children: ReactNode;
}

const TONES: Record<BadgeTone, string> = {
  neutral: "border-border-strong bg-surface-2 text-foreground-soft",
  accent: "border-accent-border bg-accent-strong/10 text-accent",
  significant: "border-significant-border bg-significant-strong/10 text-significant",
  warning: "border-warning-border bg-warning-strong/10 text-warning",
  danger: "border-danger-border bg-danger-strong/10 text-danger",
  info: "border-info/40 bg-info/10 text-info-soft",
};

export function Badge({
  tone = "neutral",
  pill = false,
  className = "",
  children,
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 text-xs font-medium ${
        pill ? "rounded-full" : "rounded-sm"
      } ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

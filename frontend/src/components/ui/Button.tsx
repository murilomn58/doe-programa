/** Botão de ação. primary=indigo (forms), accent=cyan (gerar/rodar), outline/subtle/ghost=secundário. */

import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant =
  | "primary"
  | "accent"
  | "outline"
  | "subtle"
  | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-on-primary hover:bg-primary-strong focus-visible:ring-primary",
  accent:
    "bg-accent-strong text-on-accent hover:bg-accent-deep focus-visible:ring-accent-strong",
  outline:
    "border border-border-strong text-foreground hover:border-accent-strong hover:text-accent focus-visible:ring-accent-strong",
  subtle:
    "bg-surface-2 text-foreground hover:bg-surface-3 focus-visible:ring-border-strong",
  ghost:
    "text-muted hover:bg-surface-2 hover:text-foreground focus-visible:ring-border-strong",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  type = "button",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

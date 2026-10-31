/** Botão de ação. primary=terracota (forms), accent=teal (gerar/rodar), outline/subtle/ghost=secundário. */

import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Superfície da ação primária sólida — fonte única para todo botão terracota
 * do app (o `Button` abaixo e os botões ad-hoc que não usam este componente).
 *
 * Repouso em `primary-strong` (#A9542F), não em `primary` (#C2673F): branco
 * sobre `primary` mede 3,96:1 e reprova o mínimo AA de 4,5:1 para texto normal;
 * sobre `primary-strong` sobe para 5,26:1.
 *
 * Como `primary-strong` já é o terracota mais escuro da paleta e `tokens.css` é
 * decisão travada (vem do site irmão), o hover é derivado dos próprios tokens
 * via `color-mix` — 80% terracota + 20% tinta = #8D482A, 6,77:1 — em vez de
 * introduzir uma cor literal nova fora da identidade.
 */
export const PRIMARY_SURFACE =
  "bg-primary-strong text-on-primary hover:bg-[color-mix(in_srgb,var(--color-primary-strong)_80%,var(--color-foreground-strong))]";

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
  primary: `${PRIMARY_SURFACE} focus-visible:ring-primary-strong`,
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

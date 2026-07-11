/** Campo de texto/número. mono para entrada numérica (tabular). */

import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  mono?: boolean;
}

const BASE =
  "rounded-md border border-border-strong bg-surface-0 px-3 py-2 text-foreground outline-none transition placeholder:text-faint focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50";

export function Input({ mono = false, className = "", ...rest }: InputProps) {
  return (
    <input
      className={`${BASE} ${mono ? "font-mono tabular-nums" : ""} ${className}`}
      {...rest}
    />
  );
}

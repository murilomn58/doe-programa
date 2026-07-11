/** Dropdown nativo estilizado ao vocabulário de controles. */

import type { SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

const BASE =
  "rounded-md border border-border-strong bg-surface-0 px-3 py-2 text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50";

export function Select({ className = "", children, ...rest }: SelectProps) {
  return (
    <select className={`${BASE} ${className}`} {...rest}>
      {children}
    </select>
  );
}

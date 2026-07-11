/** Nota-guia que ensina o passo atual. Painel indigo suave com etiqueta. */

import type { ReactNode } from "react";

interface CalloutProps {
  label?: string;
  children: ReactNode;
  className?: string;
}

export function Callout({ label = "Guia", children, className = "" }: CalloutProps) {
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border border-primary/35 bg-primary/10 px-5 py-4 ${className}`}
    >
      <span className="mt-px shrink-0 rounded-sm border border-primary/40 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary-soft">
        {label}
      </span>
      <p className="m-0 text-sm leading-normal text-foreground-soft">{children}</p>
    </div>
  );
}

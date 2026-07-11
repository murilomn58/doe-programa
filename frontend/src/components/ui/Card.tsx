/** Painel padrão (rounded-xl, borda, sombra). title opcional com slot `right`. */

import type { ElementType, ReactNode } from "react";

interface CardProps {
  title?: ReactNode;
  right?: ReactNode;
  as?: ElementType;
  className?: string;
  children: ReactNode;
}

export function Card({
  title,
  right,
  as: Tag = "section",
  className = "",
  children,
}: CardProps) {
  return (
    <Tag
      className={`rounded-xl border border-border bg-surface-1 p-6 shadow-lg ${className}`}
    >
      {title || right ? (
        <header className="mb-4 flex items-baseline justify-between gap-3">
          {title ? (
            <h3 className="text-lg font-medium text-foreground">{title}</h3>
          ) : (
            <span />
          )}
          {right}
        </header>
      ) : null}
      {children}
    </Tag>
  );
}

/** Presentational: a titled card that frames one interactive chart. */

import type { ReactNode } from "react";

interface PlotCardProps {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
  /** Extra classes for the plot container (e.g. taller charts). */
  bodyClassName?: string;
}

export function PlotCard({
  title,
  hint,
  children,
  bodyClassName = "h-80",
}: PlotCardProps) {
  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-lg">
      <header className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-slate-200">{title}</h3>
        {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
      </header>
      <div className={`w-full ${bodyClassName}`}>{children}</div>
    </section>
  );
}

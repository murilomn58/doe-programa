/**
 * Presentational: a light-theme section block for the printable /report route.
 *
 * The report renders on WHITE paper (it is captured by Playwright → PDF), so
 * this component is intentionally light (unlike the dark scientific UI). It
 * carries a title, optional short PT-BR interpretation, and its children.
 */

import type { ReactNode } from "react";

interface ReportSectionProps {
  title: string;
  /** Short PT-BR reading of the section (e.g. "R² = 0,98 indica bom ajuste"). */
  interpretation?: ReactNode;
  children: ReactNode;
}

export function ReportSection({
  title,
  interpretation,
  children,
}: ReportSectionProps) {
  return (
    <section className="report-section mb-8 break-inside-avoid">
      <h2 className="mb-3 border-b border-slate-300 pb-1 text-lg font-semibold text-slate-900">
        {title}
      </h2>
      {interpretation ? (
        <p className="mb-3 text-sm leading-relaxed text-slate-600">
          {interpretation}
        </p>
      ) : null}
      {children}
    </section>
  );
}

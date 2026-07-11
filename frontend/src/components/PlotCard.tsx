/** Presentational: a titled card that frames one interactive chart. */

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import type { ExportFormat } from "@/api/exportPlots";

/** Formatos oferecidos no menu de export (subconjunto legível de ExportFormat). */
export type PlotExportFormat = Extract<ExportFormat, "png" | "svg" | "pdf">;

export interface PlotExportOptions {
  /** Dispara o export no formato escolhido (o container chama a API). */
  onExport: (format: PlotExportFormat) => void;
  /** Formatos oferecidos; default: PNG (600 DPI), SVG, PDF. */
  formats?: PlotExportFormat[];
  /** true enquanto um export está em andamento (desabilita o botão). */
  busy?: boolean;
}

interface PlotCardProps {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
  /** Extra classes for the plot container (e.g. taller charts). */
  bodyClassName?: string;
  /** Menu de export opcional; ausente → nenhum botão renderizado. */
  exportOptions?: PlotExportOptions;
}

const DEFAULT_FORMATS: PlotExportFormat[] = ["png", "svg", "pdf"];

const FORMAT_LABEL: Record<PlotExportFormat, string> = {
  png: "PNG (600 DPI)",
  svg: "SVG (vetorial)",
  pdf: "PDF (vetorial)",
};

export function PlotCard({
  title,
  hint,
  children,
  bodyClassName = "h-80",
  exportOptions,
}: PlotCardProps) {
  return (
    <section className="rounded-xl border border-border bg-surface-1 p-4 shadow-lg">
      <header className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <div className="flex items-center gap-3">
          {hint ? <span className="text-xs text-faint">{hint}</span> : null}
          {exportOptions ? <ExportMenu options={exportOptions} /> : null}
        </div>
      </header>
      <div className={`w-full ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/** Botão "⤓ Exportar" + dropdown de formatos (fecha ao clicar fora / Esc). */
function ExportMenu({ options }: { options: PlotExportOptions }) {
  const { onExport, formats = DEFAULT_FORMATS, busy = false } = options;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-md border border-border-strong bg-surface-2/60 px-2 py-1 text-xs font-medium text-foreground-soft transition-colors hover:border-accent-strong hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Exportando…" : "⤓ Exportar"}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-md border border-border-strong bg-surface-1 shadow-xl"
        >
          {formats.map((fmt) => (
            <button
              key={fmt}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onExport(fmt);
              }}
              className="block w-full px-3 py-2 text-left text-xs text-foreground-soft transition-colors hover:bg-surface-2 hover:text-accent"
            >
              {FORMAT_LABEL[fmt]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

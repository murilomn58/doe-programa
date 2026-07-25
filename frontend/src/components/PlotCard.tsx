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
  png: "PNG",
  svg: "SVG",
  pdf: "PDF",
};

/** Micro-descrição didática de cada formato (exibida no dropdown). */
const FORMAT_DESC: Record<PlotExportFormat, string> = {
  png: "600 DPI, pronto pra artigo",
  svg: "vetorial, edita no Illustrator/Inkscape",
  pdf: "vetorial, pronto pra imprimir",
};

const EXPORT_ERROR_MESSAGE =
  "Não foi possível gerar o arquivo. Tente de novo em instantes.";

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
  const [error, setError] = useState<string | null>(null);
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

  /**
   * Dispara o export com rede de segurança local: a API atual devolve void e o
   * container trata o erro, mas se o callback lançar (ou devolver uma Promise
   * rejeitada), mostramos um aviso amigável aqui em vez de falhar em silêncio.
   */
  function handleExport(fmt: PlotExportFormat) {
    setOpen(false);
    setError(null);
    try {
      const result = onExport(fmt) as void | Promise<void>;
      if (result instanceof Promise) {
        result.catch(() => setError(EXPORT_ERROR_MESSAGE));
      }
    } catch {
      setError(EXPORT_ERROR_MESSAGE);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setError(null);
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-md border border-border-strong bg-surface-2/60 px-2 py-1 text-xs font-medium text-foreground-soft transition-colors hover:border-accent-strong hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? (
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
            />
            Gerando…
          </span>
        ) : (
          "⤓ Exportar"
        )}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-60 overflow-hidden rounded-md border border-border-strong bg-surface-1 shadow-xl"
        >
          {formats.map((fmt) => (
            <button
              key={fmt}
              type="button"
              role="menuitem"
              onClick={() => handleExport(fmt)}
              className="block w-full px-3 py-2 text-left transition-colors hover:bg-surface-2"
            >
              <span className="block text-xs font-medium text-foreground">
                {FORMAT_LABEL[fmt]}
              </span>
              <span className="block text-[11px] leading-snug text-faint">
                {FORMAT_DESC[fmt]}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {error && !open ? (
        <div
          role="alert"
          className="absolute right-0 z-20 mt-1 flex w-60 items-start gap-2 rounded-md border border-danger/40 bg-surface-1 px-3 py-2 shadow-xl"
        >
          <span className="text-xs leading-snug text-danger">{error}</span>
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={() => setError(null)}
            className="ml-auto text-xs text-muted transition-colors hover:text-foreground"
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}

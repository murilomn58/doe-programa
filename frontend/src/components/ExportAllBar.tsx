/**
 * Barra de exportação em lote: baixa todas as figuras da análise em PNG de
 * publicação e leva ao relatório completo. Componente presentational puro;
 * o container decide como gerar os arquivos (onExportAll) e informa progresso.
 */

"use client";

import Link from "next/link";
import { useState } from "react";

export interface ExportAllBarProps {
  /** Nomes das figuras disponíveis nesta análise (usado para contagem). */
  plots: string[];
  /** Dispara o download em lote; o container resolve quando terminar. */
  onExportAll: (format: "png") => Promise<void>;
  /** Rota do relatório completo (versão imprimível). */
  reportHref: string;
  /** true enquanto o lote está sendo gerado (desabilita o botão). */
  busy: boolean;
  /** Progresso do lote (ex.: 3 de 8) ou null quando não há como medir. */
  progress: { done: number; total: number } | null;
}

const EXPORT_ALL_ERROR =
  "Não foi possível baixar as figuras. Tente de novo em instantes.";

export function ExportAllBar({
  plots,
  onExportAll,
  reportHref,
  busy,
  progress,
}: ExportAllBarProps) {
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    onExportAll("png").catch(() => setError(EXPORT_ALL_ERROR));
  }

  return (
    <section className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-surface-1 px-4 py-3 shadow-lg">
      <div className="flex min-w-24 flex-col">
        <h3 className="text-sm font-medium text-foreground">Exportar</h3>
        <span className="text-xs text-faint">
          {plots.length === 1 ? "1 figura" : `${plots.length} figuras`} nesta
          análise
        </span>
      </div>

      <button
        type="button"
        disabled={busy || plots.length === 0}
        onClick={handleClick}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? (
          <>
            <span
              aria-hidden="true"
              className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
            />
            {progress
              ? `Gerando ${progress.done}/${progress.total}…`
              : "Gerando…"}
          </>
        ) : (
          "Baixar todas as figuras (PNG 600 DPI)"
        )}
      </button>

      <Link
        href={reportHref}
        className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-accent-strong hover:text-accent"
      >
        Relatório completo →
      </Link>

      <p className="basis-full font-mono text-[11px] text-faint sm:ml-auto sm:basis-auto sm:text-right">
        as figuras saem em qualidade de publicação, renderizadas pelo motor
        científico
      </p>

      {error ? (
        <p role="alert" className="basis-full text-xs text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}

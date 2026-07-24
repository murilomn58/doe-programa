"use client";

/** Barra fina de status do motor científico local (boot do Pyodide).
 *
 * Honesta com o pesquisador: a primeira visita baixa o ambiente Python
 * (~40-70s); depois fica em cache e abre em segundos. Some sozinha quando
 * análise E exportação estão prontas.
 */

import { useEffect, useState } from "react";
import {
  getEngineStatus,
  subscribeEngineStatus,
  type EngineStatus,
} from "@/engine/client";

export function EngineStatusBar() {
  const [status, setStatus] = useState<EngineStatus>(getEngineStatus);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => subscribeEngineStatus(setStatus), []);

  if (dismissed || status.stage === "ready-export") return null;

  const failed = status.stage === "boot-failed";
  const exportFailed = status.stage === "export-failed";

  const label = failed
    ? `O motor científico não iniciou (${status.detail ?? "erro desconhecido"}). Recarrega a página pra tentar de novo.`
    : exportFailed
      ? "Análise pronta. O exportador de figuras não carregou; recarrega a página se precisar exportar."
      : status.analysisReady
        ? "Análise pronta. Carregando o exportador de figuras em segundo plano…"
        : `Preparando o laboratório: ${status.detail ?? "iniciando"}… (a primeira visita demora ~1 min; depois fica salvo no navegador)`;

  return (
    <div
      role="status"
      className={`sticky top-0 z-50 flex items-center gap-3 border-b px-4 py-2 text-sm ${
        failed
          ? "border-danger-border bg-danger-surface text-danger"
          : "border-border bg-surface-1 text-foreground-soft"
      }`}
    >
      {!failed && !status.analysisReady && (
        <span
          aria-hidden
          className="inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent"
        />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {(status.analysisReady || failed || exportFailed) && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded px-2 py-0.5 text-xs text-muted hover:bg-surface-2"
          aria-label="Fechar aviso"
        >
          fechar
        </button>
      )}
    </div>
  );
}

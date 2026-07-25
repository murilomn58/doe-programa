"use client";

/** Painel do assistente: comentários interpretativos + sugestões acionáveis.
 *  Material de bancada: NUNCA entra no relatório exportado. */

import { useState } from "react";

import type { AdvisorReport, AdvisorSuggestion } from "@/api/advisor";

interface AdvisorPanelProps {
  report: AdvisorReport | null;
  isLoading: boolean;
  busy: boolean;
  onAction: (action: string) => void;
}

const SEVERITY_STYLE: Record<string, string> = {
  warn: "border-warning-border bg-warning-surface/50",
  info: "border-accent-border bg-accent-surface/40",
  good: "border-significant-border bg-significant-surface/40",
};

const ACTION_LABEL: Record<string, string> = {
  add_center_points: "Adicionar 3 pontos centrais",
  extend_ccd: "Estender para CCD",
  add_replicates: "Adicionar 1 réplica",
};

function actionLabel(s: AdvisorSuggestion): string | null {
  if (!s.action) return null;
  if (s.action.startsWith("switch_model:")) {
    const m = s.action.split(":")[1];
    const names: Record<string, string> = {
      linear: "Testar modelo Linear",
      linear_interactions: "Testar Linear + Interações",
      linear_quadratic: "Testar Linear + Quadrático",
      full: "Testar modelo Completo",
    };
    return names[m] ?? `Testar modelo ${m}`;
  }
  return ACTION_LABEL[s.action] ?? null;
}

export function AdvisorPanel({ report, isLoading, busy, onAction }: AdvisorPanelProps) {
  const [open, setOpen] = useState(true);

  if (isLoading) {
    return (
      <section className="mt-6 rounded-xl border border-border bg-surface-1 p-5 text-sm text-muted">
        Assistente analisando os resultados…
      </section>
    );
  }
  if (!report || (report.comments.length === 0 && report.suggestions.length === 0)) {
    return null;
  }

  return (
    <section className="mt-6 rounded-xl border border-border bg-surface-1 p-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <span aria-hidden className="text-lg">🧭</span>
          <span className="text-lg font-medium text-foreground">
            Sugestões do assistente
          </span>
          <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[11px] text-muted">
            não entra no relatório
          </span>
        </span>
        <span className="text-muted">{open ? "−" : "+"}</span>
      </button>

      {open ? (
        <div className="mt-4 flex flex-col gap-3">
          {report.suggestions.map((s) => {
            const label = actionLabel(s);
            return (
              <div
                key={s.id}
                className={`rounded-lg border p-4 ${SEVERITY_STYLE[s.severity] ?? SEVERITY_STYLE.info}`}
              >
                <p className="font-medium text-foreground">{s.title}</p>
                <p className="mt-1 text-sm text-foreground-soft">{s.rationale}</p>
                {label && s.action ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onAction(s.action as string)}
                    className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-50"
                  >
                    {busy ? "Aplicando…" : label}
                  </button>
                ) : null}
              </div>
            );
          })}

          {report.comments.length > 0 ? (
            <div className="rounded-lg border border-border-subtle bg-surface-0 p-4">
              <p className="font-mono text-xs uppercase tracking-wider text-muted">
                Como ler estes resultados
              </p>
              <ul className="mt-2 flex flex-col gap-2">
                {report.comments.map((c) => (
                  <li key={c.topic + c.text.slice(0, 16)} className="text-sm text-foreground-soft">
                    <strong className="text-foreground">{c.topic}:</strong> {c.text}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

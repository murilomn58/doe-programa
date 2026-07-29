"use client";

import { useState } from "react";

import type {
  CompletionRead,
  DesignMatchRead,
  FactorScaleRead,
  ModelAssessmentRead,
  RetroDiagnoseResponse,
} from "@/domain/retrospective";

interface RetroDiagnosisCardProps {
  diagnosis: RetroDiagnoseResponse | undefined;
  isLoading: boolean;
  /** Append completion runs (natural values) to the editable table. */
  onAddRuns: (runs: Record<string, number | string>[]) => void;
  /** Materialize + navigate to the analysis of the best model. */
  onAnalyze: () => void;
  isAnalyzing: boolean;
  analyzeError: string | null;
}

const DESIGN_LABELS: Record<string, string> = {
  full_factorial_2k: "Fatorial completo 2ᵏ",
  fractional_factorial_2kp: "Fatorial fracionado 2ᵏ⁻ᵖ",
  central_composite: "Composto central (CCD)",
  box_behnken: "Box-Behnken",
  plackett_burman: "Plackett-Burman",
  definitive_screening: "Triagem definitiva (DSD)",
  taguchi: "Taguchi",
};

const MODEL_LABELS: Record<string, string> = {
  linear: "Linear",
  linear_interactions: "Linear + Interações",
  linear_quadratic: "Linear + Quadrático",
  full: "Completo",
};

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

function designLabel(type: string): string {
  return DESIGN_LABELS[type] ?? type;
}

function modelLabel(model: string): string {
  return MODEL_LABELS[model] ?? model;
}

function fmt(n: number | null | undefined, digits = 3): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("pt-BR", { maximumFractionDigits: digits });
}

const card =
  "rounded-xl border border-border bg-surface-1 p-5 shadow-lg";
const sectionTitle =
  "mb-2 text-xs font-semibold uppercase tracking-wide text-muted";

export function RetroDiagnosisCard({
  diagnosis,
  isLoading,
  onAddRuns,
  onAnalyze,
  isAnalyzing,
  analyzeError,
}: RetroDiagnosisCardProps) {
  const empty =
    !diagnosis ||
    diagnosis.n_rows_valid < 3 ||
    diagnosis.factors.length === 0;

  if (empty) {
    return (
      <div className={card}>
        <h2 className="mb-2 text-lg font-medium text-foreground">Diagnóstico</h2>
        {isLoading ? (
          <p className="text-sm text-muted">Diagnosticando…</p>
        ) : (
          <p className="text-sm text-muted">
            Preencha ao menos <span className="text-foreground">1 fator</span>,{" "}
            <span className="text-foreground">1 resposta</span> e{" "}
            <span className="text-foreground">3 linhas</span> com valores para o
            programa detectar o planejamento por trás dos seus dados.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`${card} space-y-6`}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-medium text-foreground">Diagnóstico</h2>
        <span className="font-mono text-xs text-faint">
          {diagnosis.n_rows_valid}/{diagnosis.n_rows} linhas válidas
          {isLoading ? " · atualizando…" : ""}
        </span>
      </div>

      {diagnosis.row_issues.length > 0 ? (
        <div className="rounded-md border border-warning-border/60 bg-warning-strong/5 p-3 text-xs text-warning-soft">
          <p className="mb-1 font-semibold">
            {diagnosis.row_issues.length} linha(s) com problema:
          </p>
          <ul className="space-y-0.5">
            {diagnosis.row_issues.slice(0, 5).map((issue) => (
              <li key={issue.row}>
                Linha {issue.row}: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <MatchesSection
        matches={diagnosis.design_matches}
        bestDesign={diagnosis.best_design ?? null}
      />

      <CodingSection factors={diagnosis.factors} />

      <ReplicatesSection
        dfPureError={diagnosis.replicates.df_pure_error}
        nPointsReplicated={diagnosis.replicates.n_points_replicated}
        runsPerPointMax={diagnosis.replicates.runs_per_point_max}
      />

      <ModelsSection
        models={diagnosis.models}
        bestModel={diagnosis.best_model ?? null}
        responseUsed={diagnosis.response_used ?? null}
      />

      {diagnosis.completions.length > 0 ? (
        <section>
          <h3 className={sectionTitle}>Como completar o planejamento</h3>
          <div className="space-y-3">
            {diagnosis.completions.map((completion, i) => (
              <CompletionBlock
                key={`${completion.target}-${i}`}
                completion={completion}
                onAddRuns={onAddRuns}
              />
            ))}
          </div>
        </section>
      ) : null}

      <div className="border-t border-border pt-4">
        <button
          type="button"
          onClick={onAnalyze}
          disabled={isAnalyzing || !diagnosis.best_model}
          className="w-full rounded-md bg-accent-strong px-4 py-3 text-sm font-semibold text-on-accent transition hover:bg-accent-mid disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isAnalyzing
            ? "Preparando análise…"
            : diagnosis.best_model
              ? `Analisar com o melhor modelo (${modelLabel(diagnosis.best_model)}) →`
              : "Nenhum modelo estimável ainda"}
        </button>
        {analyzeError ? (
          <p className="mt-2 text-xs text-danger">{analyzeError}</p>
        ) : null}
      </div>
    </div>
  );
}

// --- design matches ----------------------------------------------------------

function MatchesSection({
  matches,
  bestDesign,
}: {
  matches: DesignMatchRead[];
  bestDesign: string | null;
}) {
  if (matches.length === 0) {
    return (
      <section>
        <h3 className={sectionTitle}>Planejamento detectado</h3>
        <p className="text-sm text-muted">
          Nenhuma família de planejamento reconhecida. Os dados parecem
          irregulares ou personalizados.
        </p>
      </section>
    );
  }
  return (
    <section>
      <h3 className={sectionTitle}>Planejamento detectado</h3>
      <div className="space-y-2">
        {matches.map((match, i) => (
          <MatchChip
            key={`${match.design_type}-${match.variant ?? ""}-${i}`}
            match={match}
            isBest={match.design_type === bestDesign && i === 0}
          />
        ))}
      </div>
    </section>
  );
}

function statusStyle(status: DesignMatchRead["status"]): {
  dot: string;
  border: string;
} {
  switch (status) {
    case "complete":
      return { dot: "bg-significant", border: "border-significant-border/60" };
    case "partial":
      return { dot: "bg-warning", border: "border-warning-border/60" };
    default:
      return { dot: "bg-faint", border: "border-border" };
  }
}

function MatchChip({
  match,
  isBest,
}: {
  match: DesignMatchRead;
  isBest: boolean;
}) {
  const [open, setOpen] = useState(isBest);
  const style = statusStyle(match.status);

  return (
    <div className={`rounded-md border ${style.border} bg-surface-0/40`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
        <span className="text-sm font-medium text-foreground">
          {designLabel(match.design_type)}
          {match.variant ? (
            <span className="text-muted"> · {match.variant}</span>
          ) : null}
        </span>
        {match.status === "partial" ? (
          <span className="rounded bg-warning-strong/15 px-1.5 py-0.5 text-[10px] font-medium text-warning-soft">
            {fmt(match.match_pct, 0)}%
          </span>
        ) : null}
        {isBest ? (
          <span className="rounded bg-accent-strong/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">
            melhor
          </span>
        ) : null}
        <span className="ml-auto text-xs text-faint">
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open ? (
        <div className="space-y-1.5 border-t border-border-subtle px-3 py-2 text-xs text-muted">
          <p>{match.detail}</p>
          <div className="flex flex-wrap gap-2">
            {match.resolution ? (
              <span className="rounded bg-surface-1 px-1.5 py-0.5 font-mono text-foreground-soft">
                Resolução {ROMAN[match.resolution] ?? match.resolution}
              </span>
            ) : null}
            <span className="rounded bg-surface-1 px-1.5 py-0.5 font-mono text-foreground-soft">
              {match.n_matched}/{match.n_expected} ensaios
            </span>
            {match.missing_runs.length > 0 ? (
              <span className="rounded bg-surface-1 px-1.5 py-0.5 font-mono text-warning-soft">
                {match.missing_runs.length} ausente(s)
              </span>
            ) : null}
          </div>
          {match.defining_relation ? (
            <p className="font-mono text-foreground-soft">
              {match.defining_relation}
            </p>
          ) : null}
          {match.aliasing && match.aliasing.length > 0 ? (
            <div>
              <span className="text-faint">Aliases: </span>
              <span className="font-mono text-foreground-soft">
                {match.aliasing.join(" · ")}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// --- coding ------------------------------------------------------------------

function CodingSection({ factors }: { factors: FactorScaleRead[] }) {
  return (
    <section>
      <h3 className={sectionTitle}>Codificação inferida</h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="text-faint">
              <th className="px-2 py-1 text-left font-medium">Fator</th>
              <th className="px-2 py-1 text-right font-medium">−1</th>
              <th className="px-2 py-1 text-right font-medium">centro</th>
              <th className="px-2 py-1 text-right font-medium">+1</th>
              <th className="px-2 py-1 text-right font-medium">níveis</th>
              <th className="px-2 py-1 text-right font-medium">α</th>
            </tr>
          </thead>
          <tbody>
            {factors.map((f) => (
              <tr key={f.name} className="border-t border-border-subtle">
                <td className="px-2 py-1 text-foreground">
                  <div className="flex items-center gap-1.5">
                    <span>{f.name}</span>
                    {f.factor_type === "qualitative" ? (
                      <span className="rounded bg-info/15 px-1 py-0.5 text-[9px] font-medium text-info">
                        qual
                        {f.labels && f.labels.length >= 2
                          ? `: ${f.labels[0]}→−1, ${f.labels[f.labels.length - 1]}→+1`
                          : ""}
                      </span>
                    ) : null}
                    {f.is_constant ? (
                      <span className="rounded bg-warning-strong/15 px-1 py-0.5 text-[9px] font-medium text-warning-soft">
                        constante
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-2 py-1 text-right font-mono text-foreground-soft">
                  {fmt(f.low)}
                </td>
                <td className="px-2 py-1 text-right font-mono text-foreground-soft">
                  {fmt(f.center)}
                </td>
                <td className="px-2 py-1 text-right font-mono text-foreground-soft">
                  {fmt(f.high)}
                </td>
                <td className="px-2 py-1 text-right font-mono text-foreground-soft">
                  {f.n_levels}
                </td>
                <td className="px-2 py-1 text-right font-mono text-foreground-soft">
                  {f.alpha !== null && f.alpha !== undefined
                    ? fmt(f.alpha, 3)
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// --- replicates --------------------------------------------------------------

function ReplicatesSection({
  dfPureError,
  nPointsReplicated,
  runsPerPointMax,
}: {
  dfPureError: number;
  nPointsReplicated: number;
  runsPerPointMax: number;
}) {
  return (
    <section>
      <h3 className={sectionTitle}>Réplicas</h3>
      <div className="flex flex-wrap gap-3 text-xs text-foreground-soft">
        <span className="rounded bg-surface-0/60 px-2 py-1">
          Erro puro: <span className="font-mono">gl = {dfPureError}</span>
        </span>
        <span className="rounded bg-surface-0/60 px-2 py-1">
          Pontos replicados:{" "}
          <span className="font-mono">{nPointsReplicated}</span>
        </span>
        <span className="rounded bg-surface-0/60 px-2 py-1">
          Máx. réplicas/ponto:{" "}
          <span className="font-mono">{runsPerPointMax}</span>
        </span>
      </div>
    </section>
  );
}

// --- models ------------------------------------------------------------------

function modelBadge(model: ModelAssessmentRead): {
  text: string;
  cls: string;
} {
  switch (model.status) {
    case "estimable":
      return {
        text: `estimável (gl=${model.df_resid ?? "?"})`,
        cls: "bg-significant-strong/15 text-significant-soft",
      };
    case "saturated":
      return {
        text: "saturado — Lenth",
        cls: "bg-warning-strong/15 text-warning-soft",
      };
    case "no_data":
      return { text: "sem dados", cls: "bg-surface-2 text-muted" };
    default:
      return { text: "não estimável", cls: "bg-surface-2 text-muted" };
  }
}

function ModelsSection({
  models,
  bestModel,
  responseUsed,
}: {
  models: ModelAssessmentRead[];
  bestModel: string | null;
  responseUsed: string | null;
}) {
  return (
    <section>
      <h3 className={sectionTitle}>
        Modelos ajustáveis
        {responseUsed ? (
          <span className="ml-1 normal-case text-faint">
            (resposta: {responseUsed})
          </span>
        ) : null}
      </h3>
      <div className="space-y-1.5">
        {models.map((model) => {
          const badge = modelBadge(model);
          const isBest = model.model === bestModel;
          return (
            <div
              key={model.model}
              className={`flex items-center gap-2 rounded-md border px-3 py-1.5 ${
                isBest
                  ? "border-accent-border/60 bg-accent-strong/5"
                  : "border-border-subtle bg-surface-0/40"
              }`}
            >
              <span className="text-sm text-foreground">
                {modelLabel(model.model)}
              </span>
              {isBest ? (
                <span className="rounded bg-accent-strong/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                  melhor
                </span>
              ) : null}
              <span
                className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium ${badge.cls}`}
                title={model.reason ?? undefined}
              >
                {badge.text}
              </span>
            </div>
          );
        })}
      </div>
      {models.some((m) => m.reason && m.status !== "estimable") ? (
        <ul className="mt-1.5 space-y-0.5 text-[11px] text-faint">
          {models
            .filter((m) => m.reason && m.status !== "estimable")
            .map((m) => (
              <li key={`reason-${m.model}`}>
                {modelLabel(m.model)}: {m.reason}
              </li>
            ))}
        </ul>
      ) : null}
    </section>
  );
}

// --- completions -------------------------------------------------------------

function CompletionBlock({
  completion,
  onAddRuns,
}: {
  completion: CompletionRead;
  onAddRuns: (runs: Record<string, number | string>[]) => void;
}) {
  const [copied, setCopied] = useState(false);

  const columns =
    completion.runs_to_add.length > 0
      ? Object.keys(completion.runs_to_add[0])
      : [];

  function toTsv(): string {
    const header = columns.join("\t");
    const body = completion.runs_to_add
      .map((run) => columns.map((c) => String(run[c] ?? "")).join("\t"))
      .join("\n");
    return `${header}\n${body}`;
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(toTsv());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context) — silently ignore.
    }
  }

  return (
    <div className="rounded-md border border-border bg-surface-0/40 p-3">
      <p className="text-sm font-medium text-foreground">{completion.title}</p>
      <p className="mt-1 text-xs text-muted">{completion.rationale}</p>

      {completion.enables.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px]">
          <span className="text-faint">Habilita:</span>
          {completion.enables.map((e) => (
            <span
              key={e}
              className="rounded bg-significant-strong/15 px-1.5 py-0.5 font-medium text-significant-soft"
            >
              {modelLabel(e)}
            </span>
          ))}
        </div>
      ) : null}

      {columns.length > 0 ? (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="text-faint">
                {columns.map((c) => (
                  <th key={c} className="px-1.5 py-0.5 text-right font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {completion.runs_to_add.map((run, i) => (
                <tr key={i} className="border-t border-border-subtle">
                  {columns.map((c) => (
                    <td
                      key={c}
                      className="px-1.5 py-0.5 text-right font-mono text-foreground-soft"
                    >
                      {String(run[c] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded border border-border-strong px-2.5 py-1 text-[11px] font-medium text-foreground transition hover:border-faint hover:bg-surface-2"
        >
          {copied ? "Copiado ✓" : "Copiar (TSV)"}
        </button>
        <button
          type="button"
          onClick={() => onAddRuns(completion.runs_to_add)}
          className="rounded border border-accent-border bg-accent-strong/10 px-2.5 py-1 text-[11px] font-medium text-accent transition hover:bg-accent-strong/20"
        >
          + Adicionar à tabela ({completion.n_runs_to_add})
        </button>
      </div>
    </div>
  );
}

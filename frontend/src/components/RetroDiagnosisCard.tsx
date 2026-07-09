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
  "rounded-xl border border-slate-700 bg-slate-800 p-5 shadow-lg";
const sectionTitle =
  "mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400";

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
        <h2 className="mb-2 text-lg font-medium text-slate-200">Diagnóstico</h2>
        {isLoading ? (
          <p className="text-sm text-slate-400">Diagnosticando…</p>
        ) : (
          <p className="text-sm text-slate-400">
            Preencha ao menos <span className="text-slate-200">1 fator</span>,{" "}
            <span className="text-slate-200">1 resposta</span> e{" "}
            <span className="text-slate-200">3 linhas</span> com valores para o
            programa detectar o planejamento por trás dos seus dados.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`${card} space-y-6`}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-medium text-slate-200">Diagnóstico</h2>
        <span className="font-mono text-xs text-slate-500">
          {diagnosis.n_rows_valid}/{diagnosis.n_rows} linhas válidas
          {isLoading ? " · atualizando…" : ""}
        </span>
      </div>

      {diagnosis.row_issues.length > 0 ? (
        <div className="rounded-md border border-amber-800/60 bg-amber-500/5 p-3 text-xs text-amber-300">
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

      <div className="border-t border-slate-700 pt-4">
        <button
          type="button"
          onClick={onAnalyze}
          disabled={isAnalyzing || !diagnosis.best_model}
          className="w-full rounded-md bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isAnalyzing
            ? "Preparando análise…"
            : diagnosis.best_model
              ? `Analisar com o melhor modelo (${modelLabel(diagnosis.best_model)}) →`
              : "Nenhum modelo estimável ainda"}
        </button>
        {analyzeError ? (
          <p className="mt-2 text-xs text-red-400">{analyzeError}</p>
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
        <p className="text-sm text-slate-400">
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
      return { dot: "bg-emerald-400", border: "border-emerald-800/60" };
    case "partial":
      return { dot: "bg-amber-400", border: "border-amber-800/60" };
    default:
      return { dot: "bg-slate-500", border: "border-slate-700" };
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
    <div className={`rounded-md border ${style.border} bg-slate-900/40`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
        <span className="text-sm font-medium text-slate-200">
          {designLabel(match.design_type)}
          {match.variant ? (
            <span className="text-slate-400"> · {match.variant}</span>
          ) : null}
        </span>
        {match.status === "partial" ? (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
            {fmt(match.match_pct, 0)}%
          </span>
        ) : null}
        {isBest ? (
          <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-medium text-cyan-300">
            melhor
          </span>
        ) : null}
        <span className="ml-auto text-xs text-slate-500">
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open ? (
        <div className="space-y-1.5 border-t border-slate-800 px-3 py-2 text-xs text-slate-400">
          <p>{match.detail}</p>
          <div className="flex flex-wrap gap-2">
            {match.resolution ? (
              <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-300">
                Resolução {ROMAN[match.resolution] ?? match.resolution}
              </span>
            ) : null}
            <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-300">
              {match.n_matched}/{match.n_expected} ensaios
            </span>
            {match.missing_runs.length > 0 ? (
              <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-amber-300">
                {match.missing_runs.length} ausente(s)
              </span>
            ) : null}
          </div>
          {match.defining_relation ? (
            <p className="font-mono text-slate-300">
              {match.defining_relation}
            </p>
          ) : null}
          {match.aliasing && match.aliasing.length > 0 ? (
            <div>
              <span className="text-slate-500">Aliases: </span>
              <span className="font-mono text-slate-300">
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
            <tr className="text-slate-500">
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
              <tr key={f.name} className="border-t border-slate-800">
                <td className="px-2 py-1 text-slate-200">
                  <div className="flex items-center gap-1.5">
                    <span>{f.name}</span>
                    {f.factor_type === "qualitative" ? (
                      <span className="rounded bg-violet-500/15 px-1 py-0.5 text-[9px] font-medium text-violet-300">
                        qual
                        {f.labels && f.labels.length >= 2
                          ? `: ${f.labels[0]}→−1, ${f.labels[f.labels.length - 1]}→+1`
                          : ""}
                      </span>
                    ) : null}
                    {f.is_constant ? (
                      <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-medium text-amber-300">
                        constante
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-2 py-1 text-right font-mono text-slate-300">
                  {fmt(f.low)}
                </td>
                <td className="px-2 py-1 text-right font-mono text-slate-300">
                  {fmt(f.center)}
                </td>
                <td className="px-2 py-1 text-right font-mono text-slate-300">
                  {fmt(f.high)}
                </td>
                <td className="px-2 py-1 text-right font-mono text-slate-300">
                  {f.n_levels}
                </td>
                <td className="px-2 py-1 text-right font-mono text-slate-300">
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
      <div className="flex flex-wrap gap-3 text-xs text-slate-300">
        <span className="rounded bg-slate-900/60 px-2 py-1">
          Erro puro: <span className="font-mono">gl = {dfPureError}</span>
        </span>
        <span className="rounded bg-slate-900/60 px-2 py-1">
          Pontos replicados:{" "}
          <span className="font-mono">{nPointsReplicated}</span>
        </span>
        <span className="rounded bg-slate-900/60 px-2 py-1">
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
        cls: "bg-emerald-500/15 text-emerald-300",
      };
    case "saturated":
      return {
        text: "saturado — Lenth",
        cls: "bg-amber-500/15 text-amber-300",
      };
    case "no_data":
      return { text: "sem dados", cls: "bg-slate-700 text-slate-400" };
    default:
      return { text: "não estimável", cls: "bg-slate-700 text-slate-400" };
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
          <span className="ml-1 normal-case text-slate-500">
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
                  ? "border-cyan-700/60 bg-cyan-500/5"
                  : "border-slate-800 bg-slate-900/40"
              }`}
            >
              <span className="text-sm text-slate-200">
                {modelLabel(model.model)}
              </span>
              {isBest ? (
                <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-medium text-cyan-300">
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
        <ul className="mt-1.5 space-y-0.5 text-[11px] text-slate-500">
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
    <div className="rounded-md border border-slate-700 bg-slate-900/40 p-3">
      <p className="text-sm font-medium text-slate-200">{completion.title}</p>
      <p className="mt-1 text-xs text-slate-400">{completion.rationale}</p>

      {completion.enables.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px]">
          <span className="text-slate-500">Habilita:</span>
          {completion.enables.map((e) => (
            <span
              key={e}
              className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-medium text-emerald-300"
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
              <tr className="text-slate-500">
                {columns.map((c) => (
                  <th key={c} className="px-1.5 py-0.5 text-right font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {completion.runs_to_add.map((run, i) => (
                <tr key={i} className="border-t border-slate-800">
                  {columns.map((c) => (
                    <td
                      key={c}
                      className="px-1.5 py-0.5 text-right font-mono text-slate-300"
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
          className="rounded border border-slate-600 px-2.5 py-1 text-[11px] font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-700"
        >
          {copied ? "Copiado ✓" : "Copiar (TSV)"}
        </button>
        <button
          type="button"
          onClick={() => onAddRuns(completion.runs_to_add)}
          className="rounded border border-cyan-700 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-medium text-cyan-300 transition hover:bg-cyan-500/20"
        >
          + Adicionar à tabela ({completion.n_runs_to_add})
        </button>
      </div>
    </div>
  );
}

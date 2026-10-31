"use client";

/** Edição de um experimento salvo + evolução do design (Fase B, auditoria 2026-07).
 *
 * O que É editável preservando as respostas medidas: nome/descrição do
 * experimento, nome/unidade dos fatores e os NÍVEIS naturais (o ±1 codificado
 * não muda, só o mapeamento). Mudanças estruturais entram pelo painel
 * "Evoluir o planejamento" (pontos centrais, extensão pra CCD, réplicas),
 * que ANEXA ensaios novos sem tocar nos já executados.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { NiveisFator } from "@/components/NiveisFator";
import { PRIMARY_SURFACE } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { PageHeader } from "@/components/ui/PageHeader";
import type { FactorInput } from "@/domain/design";
import {
  useAugmentDesign,
  useDeleteExperiment,
  useUpdateExperimentMeta,
  useUpdateFactors,
} from "@/hooks/useEditExperiment";
import { useExperiments } from "@/hooks/useExperiments";
import { useRuns } from "@/hooks/useRuns";
import type { FactorEdit } from "@/engine/store";

interface EditExperimentProps {
  experimentId: number;
}

interface FactorDraft {
  original: string;
  name: string;
  unit: string;
  isQuantitative: boolean;
  low: string;
  high: string;
  lowLabel: string;
  highLabel: string;
}

/**
 * Adapta o rascunho (strings, pra digitação com vírgula decimal) para o
 * `FactorInput` que o `NiveisFator` — presentational puro e compartilhado com
 * o wizard de criação — entende. Só os extremos entram aqui: a quantidade de
 * níveis não é editável nesta tela (ver `permitirEscolherQuantidade={false}`
 * abaixo e a nota no retorno desta tarefa sobre `updateFactorsPreservingResponses`).
 */
function draftParaFactorInput(d: FactorDraft): FactorInput {
  return {
    name: d.name,
    factor_type: d.isQuantitative ? "quantitative" : "qualitative",
    low: d.low !== "" ? Number(d.low.replace(",", ".")) : undefined,
    high: d.high !== "" ? Number(d.high.replace(",", ".")) : undefined,
    low_label: d.lowLabel || undefined,
    high_label: d.highLabel || undefined,
  };
}

/** Caminho inverso: devolve ao rascunho só o que o NiveisFator pode ter mudado. */
function aplicarFactorInputNoDraft(base: FactorDraft, next: FactorInput): FactorDraft {
  return {
    ...base,
    low: next.low !== undefined ? String(next.low) : "",
    high: next.high !== undefined ? String(next.high) : "",
    lowLabel: next.low_label ?? "",
    highLabel: next.high_label ?? "",
  };
}

export function EditExperiment({ experimentId }: EditExperimentProps) {
  const router = useRouter();
  const runsQuery = useRuns(experimentId);
  const { data: experiments } = useExperiments();
  const experiment = useMemo(
    () => experiments?.find((e) => e.id === experimentId) ?? null,
    [experiments, experimentId],
  );

  const updateMeta = useUpdateExperimentMeta(experimentId);
  const updateFactors = useUpdateFactors(experimentId);
  const augment = useAugmentDesign(experimentId);
  const deleteExp = useDeleteExperiment();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [drafts, setDrafts] = useState<FactorDraft[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [centerN, setCenterN] = useState(3);
  const [replicateN, setReplicateN] = useState(1);

  useEffect(() => {
    if (experiment) {
      setName(experiment.name);
      setDescription(experiment.description ?? "");
    }
  }, [experiment]);

  useEffect(() => {
    const factors = runsQuery.data?.factors;
    if (!factors) return;
    setDrafts(
      factors.map((f) => {
        const lo = f.levels.find((l) => l.coded_value === -1);
        const hi = f.levels.find((l) => l.coded_value === 1);
        return {
          original: f.name,
          name: f.name,
          unit: f.unit ?? "",
          isQuantitative: f.factor_type === "quantitative",
          low: lo?.natural_value != null ? String(lo.natural_value) : "",
          high: hi?.natural_value != null ? String(hi.natural_value) : "",
          lowLabel: lo?.label ?? "",
          highLabel: hi?.label ?? "",
        };
      }),
    );
  }, [runsQuery.data?.factors]);

  const measuredCount = useMemo(() => {
    const runs = runsQuery.data?.runs ?? [];
    return runs.filter((r) =>
      Object.values(r.response_values ?? {}).some((v) => v != null),
    ).length;
  }, [runsQuery.data?.runs]);

  const allQuantitative = drafts.every((d) => d.isQuantitative);
  const hasCcdBlock = useMemo(
    () => (runsQuery.data?.runs ?? []).some((r) => r.point_type === -1),
    [runsQuery.data?.runs],
  );

  function saveAll() {
    setFeedback(null);
    const edits: FactorEdit[] = drafts.map((d) => ({
      name: d.original,
      newName: d.name.trim() || d.original,
      unit: d.unit.trim() || null,
      ...(d.isQuantitative && d.low !== "" && d.high !== ""
        ? { low: Number(d.low.replace(",", ".")), high: Number(d.high.replace(",", ".")) }
        : {}),
      ...(!d.isQuantitative
        ? { lowLabel: d.lowLabel.trim() || undefined, highLabel: d.highLabel.trim() || undefined }
        : {}),
    }));
    updateMeta.mutate(
      { name: name.trim() || undefined, description: description.trim() || null },
      {
        onSuccess: () =>
          updateFactors.mutate(edits, {
            onSuccess: () => setFeedback("Alterações salvas. As respostas medidas foram preservadas."),
            onError: (err) => setFeedback(err instanceof Error ? err.message : "Falha ao salvar fatores."),
          }),
        onError: (err) => setFeedback(err instanceof Error ? err.message : "Falha ao salvar."),
      },
    );
  }

  function runAugment(option: Parameters<typeof augment.mutate>[0]) {
    setFeedback(null);
    augment.mutate(option, {
      onSuccess: (result) => setFeedback(result.note),
      onError: (err) => setFeedback(err instanceof Error ? err.message : "Falha ao evoluir o planejamento."),
    });
  }

  const busy = updateMeta.isPending || updateFactors.isPending || augment.isPending;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link
        href={`/experiments/${experimentId}`}
        className="text-sm text-accent hover:underline"
      >
        ← Voltar aos dados
      </Link>
      <PageHeader
        title={`Editar experimento #${experimentId}`}
        subtitle="Ajuste nomes, unidades e níveis sem perder o que você já mediu."
      />

      <Callout label="O que dá pra mudar aqui">
        Nome, descrição, unidades e os <b>níveis naturais</b> dos fatores (a
        codificação ±1 não muda, só o mapa para as unidades reais). Para mudar a
        estrutura, use <b>Evoluir o planejamento</b> logo abaixo: os ensaios já
        medidos ({measuredCount}) são sempre preservados.
      </Callout>

      {/* Meta */}
      <section className="mt-8 rounded-xl border border-border bg-surface-1 p-6">
        <h2 className="text-lg font-medium text-foreground">Identificação</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Nome do experimento</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-border bg-surface-0 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Descrição (opcional)</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-lg border border-border bg-surface-0 px-3 py-2"
            />
          </label>
        </div>
      </section>

      {/* Fatores */}
      <section className="mt-6 rounded-xl border border-border bg-surface-1 p-6">
        <h2 className="text-lg font-medium text-foreground">Fatores e níveis</h2>
        <p className="mt-1 text-sm text-muted">
          Alterar os níveis re-mapeia as colunas naturais da matriz (inclusive
          pontos centrais e axiais). As respostas não são tocadas.
        </p>
        <div className="mt-4 flex flex-col gap-4">
          {drafts.map((d, i) => (
            <div key={d.original} className="rounded-lg border border-border-subtle bg-surface-0 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted">Nome</span>
                  <input
                    value={d.name}
                    onChange={(e) =>
                      setDrafts((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                    }
                    className="rounded-lg border border-border px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted">Unidade</span>
                  <input
                    value={d.unit}
                    onChange={(e) =>
                      setDrafts((p) => p.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))
                    }
                    className="rounded-lg border border-border px-3 py-2"
                  />
                </label>
              </div>

              <NiveisFator
                factor={draftParaFactorInput(d)}
                onChange={(next) =>
                  setDrafts((p) =>
                    p.map((x, j) => (j === i ? aplicarFactorInputNoDraft(x, next) : x)),
                  )
                }
                permitirEscolherQuantidade={false}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={saveAll}
          className={`mt-4 rounded-lg ${PRIMARY_SURFACE} px-5 py-2.5 text-sm font-semibold transition disabled:opacity-50`}
        >
          {busy ? "Salvando…" : "Salvar alterações"}
        </button>
      </section>

      {/* Evoluir */}
      <section className="mt-6 rounded-xl border border-accent-border bg-accent-surface/40 p-6">
        <h2 className="text-lg font-medium text-foreground">Evoluir o planejamento</h2>
        <p className="mt-1 text-sm text-muted">
          Adicione ensaios ao que você já executou: é assim que um fatorial
          simples cresce até uma superfície de resposta, sem desperdiçar medição.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-0 p-4">
            <span className="font-medium text-foreground">+ Pontos centrais</span>
            <span className="text-xs text-muted">
              Habilita o teste de curvatura na ANOVA: se der significativo, a
              região tem curvatura e vale um CCD.
            </span>
            <div className="mt-auto flex items-center gap-2 pt-2">
              <input
                type="number"
                min={1}
                max={10}
                value={centerN}
                onChange={(e) => setCenterN(Number(e.target.value) || 1)}
                className="w-16 rounded-lg border border-border px-2 py-1.5 text-sm"
                aria-label="Quantos pontos centrais"
              />
              <button
                type="button"
                disabled={busy || !allQuantitative}
                onClick={() => runAugment({ kind: "center_points", n: centerN })}
                className="rounded-lg bg-accent-mid px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:opacity-50"
              >
                Adicionar
              </button>
            </div>
            {!allQuantitative ? (
              <span className="text-xs text-warning">Requer todos os fatores quantitativos.</span>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-0 p-4">
            <span className="font-medium text-foreground">Estender para CCD</span>
            <span className="text-xs text-muted">
              Adiciona o bloco axial (±α) + centrais: seu 2ᵏ vira um planejamento
              de superfície de resposta e o modelo quadrático fica estimável. O
              bloco novo entra na análise automaticamente.
            </span>
            <button
              type="button"
              disabled={busy || !allQuantitative || hasCcdBlock}
              onClick={() => runAugment({ kind: "extend_ccd", n_center: 3 })}
              className="mt-auto rounded-lg bg-accent-mid px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:opacity-50"
            >
              {hasCcdBlock ? "Já estendido" : "Estender"}
            </button>
          </div>
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-0 p-4">
            <span className="font-medium text-foreground">+ Réplicas</span>
            <span className="text-xs text-muted">
              Repete a matriz fatorial: melhora a estimativa do erro puro e
              destrava o teste de falta de ajuste.
            </span>
            <div className="mt-auto flex items-center gap-2 pt-2">
              <input
                type="number"
                min={1}
                max={5}
                value={replicateN}
                onChange={(e) => setReplicateN(Number(e.target.value) || 1)}
                className="w-16 rounded-lg border border-border px-2 py-1.5 text-sm"
                aria-label="Quantas réplicas extras"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => runAugment({ kind: "replicates", n: replicateN })}
                className="rounded-lg bg-accent-mid px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:opacity-50"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      </section>

      {feedback ? (
        <p className="mt-4 rounded-lg border border-border bg-surface-1 px-4 py-3 text-sm text-foreground-soft" role="status">
          {feedback}
        </p>
      ) : null}

      <div className="mt-6 flex items-center justify-between">
        <Link
          href={`/experiments/${experimentId}`}
          className="rounded-lg border border-border px-4 py-2 text-sm text-foreground-soft transition hover:bg-surface-2"
        >
          Ir para a entrada de dados →
        </Link>

        {/* Zona de perigo */}
        {confirmDelete ? (
          <span className="flex items-center gap-2 text-sm">
            <span className="text-danger">Excluir de vez? Não dá pra desfazer.</span>
            <button
              type="button"
              onClick={() =>
                deleteExp.mutate(experimentId, {
                  onSuccess: () => router.push("/experiments"),
                })
              }
              className="rounded-lg bg-danger px-3 py-1.5 font-semibold text-white"
            >
              Sim, excluir
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded-lg border border-border px-3 py-1.5"
            >
              Cancelar
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="text-sm text-danger hover:underline"
          >
            Excluir experimento
          </button>
        )}
      </div>
    </main>
  );
}

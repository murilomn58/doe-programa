"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AliasingReport } from "@/components/AliasingReport";
import {
  DesignPicker,
  defaultDesignConfig,
  designBaseRuns,
  optimalParamCount,
  TAGUCHI_AUTO,
  type DesignConfig,
} from "@/components/DesignPicker";
import { FactorForm } from "@/components/FactorForm";
import { ResponsesForm } from "@/components/ResponsesForm";
import { DataEntry } from "@/containers/DataEntry";
import type {
  DesignGenerateRequest,
  FactorInput,
  ResponseInput,
} from "@/domain/design";
import { useGenerateDesign } from "@/hooks/useDesign";
import { useTaguchiCatalog } from "@/hooks/useTaguchiCatalog";

const emptyQuantFactor = (): FactorInput => ({
  name: "",
  factor_type: "quantitative",
});

const emptyResponse = (): ResponseInput => ({ name: "" });

/**
 * Sintetiza a lista de níveis de um fator para arranjos Taguchi de 3+ níveis.
 * Fatores quantitativos recebem `nLevels` valores igualmente espaçados entre
 * baixo/alto; fatores qualitativos (só 2 rótulos na UI) ficam com 2 níveis.
 */
function withTaguchiLevels(factor: FactorInput, nLevels: number): FactorInput {
  if (nLevels <= 2 || factor.factor_type !== "quantitative") return factor;
  if (factor.low === undefined || factor.high === undefined) return factor;
  const step = (factor.high - factor.low) / (nLevels - 1);
  const levels = Array.from(
    { length: nLevels },
    (_, i) => factor.low! + step * i,
  );
  return { ...factor, levels };
}

function factorIsValid(factor: FactorInput): boolean {
  if (!factor.name.trim()) return false;
  if (factor.factor_type === "quantitative") {
    return (
      factor.low !== undefined &&
      factor.high !== undefined &&
      factor.low !== factor.high
    );
  }
  return Boolean(factor.low_label?.trim() && factor.high_label?.trim());
}

export function ExperimentSetup() {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [factors, setFactors] = useState<FactorInput[]>([
    emptyQuantFactor(),
    emptyQuantFactor(),
  ]);
  const [responses, setResponses] = useState<ResponseInput[]>([
    emptyResponse(),
  ]);
  const [replicates, setReplicates] = useState(1);
  // Estado de UI do picker (não é estado de servidor): família + knobs.
  const [designConfig, setDesignConfig] =
    useState<DesignConfig>(defaultDesignConfig);

  const generateDesign = useGenerateDesign();
  const taguchiCatalog = useTaguchiCatalog();

  const hasQualitativeFactor = factors.some(
    (f) => f.factor_type === "qualitative",
  );

  /** Ensaios totais (base × réplicas); null quando indeterminado. */
  const runCount = useMemo(() => {
    const base = designBaseRuns(
      designConfig,
      factors.length,
      taguchiCatalog.data?.arrays,
    );
    return base === null ? null : base * replicates;
  }, [designConfig, factors.length, replicates, taguchiCatalog.data]);

  const factorsReady = factors.length >= 2 && factors.every(factorIsValid);

  const requiresQuantitative =
    designConfig.designType === "central_composite" ||
    designConfig.designType === "box_behnken";

  const optimalParams = optimalParamCount(
    factors.length,
    designConfig.optimalModel,
  );

  const familyBlocked =
    (requiresQuantitative && hasQualitativeFactor) ||
    (designConfig.designType === "box_behnken" && factors.length < 3) ||
    (designConfig.designType === "fractional_factorial_2kp" &&
      designConfig.fractionalMode === "generators" &&
      designConfig.fractionalGenerators.trim().length === 0) ||
    (designConfig.designType === "plackett_burman" && factors.length < 2) ||
    (designConfig.designType === "dsd" && factors.length < 2) ||
    (designConfig.designType === "optimal" &&
      (factors.length < 2 || designConfig.optimalNRuns < optimalParams));

  const canGenerate = factorsReady && replicates >= 1 && !familyBlocked;

  function updateFactor(index: number, factor: FactorInput) {
    setFactors((prev) => prev.map((f, i) => (i === index ? factor : f)));
  }

  function updateResponse(index: number, response: ResponseInput) {
    setResponses((prev) => prev.map((r, i) => (i === index ? response : r)));
  }

  function handleGenerate() {
    const factorsPayload =
      designConfig.designType === "taguchi"
        ? factors.map((f) => withTaguchiLevels(f, designConfig.taguchiLevels))
        : factors;

    const payload: DesignGenerateRequest = {
      name: name.trim() || undefined,
      design_type: designConfig.designType,
      replicates,
      factors: factorsPayload,
      responses: responses.filter((r) => r.name.trim()),
    };
    if (designConfig.designType === "full_factorial_2k") {
      payload.center_points = designConfig.centerPoints;
    } else if (designConfig.designType === "fractional_factorial_2kp") {
      payload.center_points = designConfig.centerPoints;
      payload.fractional =
        designConfig.fractionalMode === "resolution"
          ? { resolution: designConfig.fractionalResolution }
          : { generators: designConfig.fractionalGenerators.trim() };
    } else if (designConfig.designType === "central_composite") {
      payload.ccd = {
        variant: designConfig.ccdVariant,
        center_factorial: designConfig.ccdCenterFactorial,
        center_axial: designConfig.ccdCenterAxial,
      };
    } else if (designConfig.designType === "box_behnken") {
      payload.bbd_center = designConfig.bbdCenter;
    } else if (designConfig.designType === "taguchi") {
      payload.taguchi = {
        sn_objective: designConfig.taguchiSN,
        ...(designConfig.taguchiArray !== TAGUCHI_AUTO
          ? { array_name: designConfig.taguchiArray }
          : {}),
      };
    } else if (designConfig.designType === "optimal") {
      payload.optimal = {
        criterion: designConfig.optimalCriterion,
        n_runs: designConfig.optimalNRuns,
        model: designConfig.optimalModel,
      };
    } else if (designConfig.designType === "dsd") {
      payload.dsd = { add_extra_runs: designConfig.dsdExtraRuns };
    }
    generateDesign.mutate(payload);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <Link
          href="/"
          className="text-xs text-slate-400 transition hover:text-cyan-400"
        >
          ← Voltar ao dashboard
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-cyan-400">
          Novo planejamento experimental
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Defina fatores, níveis e respostas, depois escolha a família de
          planejamento e gere a matriz de ensaios.
        </p>
      </header>

      <ol className="mb-8 flex gap-4 text-sm">
        <li
          className={
            step === 1 ? "font-semibold text-cyan-400" : "text-slate-500"
          }
        >
          1. Fatores e respostas
        </li>
        <li className="text-slate-600">·</li>
        <li
          className={
            step === 2 ? "font-semibold text-cyan-400" : "text-slate-500"
          }
        >
          2. Design e geração
        </li>
      </ol>

      {step === 1 ? (
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-300">Nome do experimento</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Solo-fibra-cimento"
                className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </label>
          </div>

          <FactorForm
            factors={factors}
            onChange={updateFactor}
            onAdd={() => setFactors((prev) => [...prev, emptyQuantFactor()])}
            onRemove={(index) =>
              setFactors((prev) => prev.filter((_, i) => i !== index))
            }
          />

          <ResponsesForm
            responses={responses}
            onChange={updateResponse}
            onAdd={() => setResponses((prev) => [...prev, emptyResponse()])}
            onRemove={(index) =>
              setResponses((prev) => prev.filter((_, i) => i !== index))
            }
          />

          <div className="flex items-center justify-between">
            {factors.length < 2 ? (
              <p className="text-sm text-amber-400">
                Adicione ao menos 2 fatores para um design fatorial.
              </p>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!factorsReady}
              className="rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continuar →
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <DesignPicker
            config={designConfig}
            onConfigChange={setDesignConfig}
            replicates={replicates}
            onReplicatesChange={setReplicates}
            factorCount={factors.length}
            hasQualitativeFactor={hasQualitativeFactor}
          />

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-blue-500 hover:text-blue-400"
            >
              ← Voltar
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate || generateDesign.isPending}
              className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generateDesign.isPending
                ? "Gerando…"
                : runCount !== null
                  ? `Gerar matriz (${runCount} ensaios)`
                  : "Gerar matriz"}
            </button>
          </div>

          {generateDesign.isError ? (
            <p className="text-sm text-red-400">
              {generateDesign.error.message}
            </p>
          ) : null}

          {generateDesign.data ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-emerald-400">
                    Matriz gerada — experimento #
                    {generateDesign.data.experiment_id}. Preencha as respostas
                    abaixo.
                  </p>
                  {generateDesign.data.array_name ? (
                    <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 font-mono text-xs text-cyan-300">
                      {generateDesign.data.array_name}
                    </span>
                  ) : null}
                  {generateDesign.data.optimal_efficiency != null ? (
                    <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 font-mono text-xs text-cyan-300">
                      D-eficiência{" "}
                      {(generateDesign.data.optimal_efficiency * 100).toFixed(1)}
                      %
                    </span>
                  ) : null}
                </div>
                <Link
                  href={`/experiments/${generateDesign.data.experiment_id}`}
                  className="text-xs text-cyan-400 transition hover:text-cyan-300"
                >
                  Abrir em página dedicada →
                </Link>
              </div>
              {generateDesign.data.aliasing &&
              generateDesign.data.aliasing.length > 0 ? (
                <AliasingReport
                  resolution={generateDesign.data.resolution ?? null}
                  aliasing={generateDesign.data.aliasing}
                />
              ) : null}
              <DataEntry experimentId={generateDesign.data.experiment_id} />
            </div>
          ) : null}
        </div>
      )}
    </main>
  );
}

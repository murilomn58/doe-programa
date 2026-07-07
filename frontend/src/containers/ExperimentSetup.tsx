"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { DesignPicker } from "@/components/DesignPicker";
import { FactorForm } from "@/components/FactorForm";
import { ResponsesForm } from "@/components/ResponsesForm";
import { RunsTable } from "@/components/RunsTable";
import type {
  DesignGenerateRequest,
  FactorInput,
  ResponseInput,
} from "@/domain/design";
import { useGenerateDesign } from "@/hooks/useDesign";

const emptyQuantFactor = (): FactorInput => ({
  name: "",
  factor_type: "quantitative",
});

const emptyResponse = (): ResponseInput => ({ name: "" });

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

  const generateDesign = useGenerateDesign();

  const runCount = useMemo(
    () => (factors.length >= 1 ? 2 ** factors.length * replicates : 0),
    [factors.length, replicates],
  );

  const canGenerate =
    factors.length >= 2 && factors.every(factorIsValid) && replicates >= 1;

  function updateFactor(index: number, factor: FactorInput) {
    setFactors((prev) => prev.map((f, i) => (i === index ? factor : f)));
  }

  function updateResponse(index: number, response: ResponseInput) {
    setResponses((prev) => prev.map((r, i) => (i === index ? response : r)));
  }

  function handleGenerate() {
    const payload: DesignGenerateRequest = {
      name: name.trim() || undefined,
      design_type: "full_factorial_2k",
      replicates,
      factors,
      responses: responses.filter((r) => r.name.trim()),
    };
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
          Novo planejamento fatorial
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Defina fatores, níveis e respostas, depois gere a matriz 2^k.
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
              disabled={!canGenerate}
              className="rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continuar →
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <DesignPicker
            designType="full_factorial_2k"
            replicates={replicates}
            onReplicatesChange={setReplicates}
            factorCount={factors.length}
            runCount={runCount}
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
                : `Gerar matriz (${runCount} ensaios)`}
            </button>
          </div>

          {generateDesign.isError ? (
            <p className="text-sm text-red-400">
              {generateDesign.error.message}
            </p>
          ) : null}

          {generateDesign.data ? (
            <RunsTable design={generateDesign.data} />
          ) : null}
        </div>
      )}
    </main>
  );
}

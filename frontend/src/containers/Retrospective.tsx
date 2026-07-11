"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { RetroDiagnosisCard } from "@/components/RetroDiagnosisCard";
import { RetroGrid } from "@/components/RetroGrid";
import { Callout } from "@/components/ui/Callout";
import type { RetroDiagnoseRequest } from "@/domain/retrospective";
import { useDiagnose, useMaterialize } from "@/hooks/useRetrospective";
import {
  columnCount,
  countRowsWithFactors,
  emptyModel,
  parseCsv,
  toDiagnoseRequest,
  type RetroTableModel,
} from "@/lib/retroTable";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

const DEBOUNCE_MS = 450;

/** Retrospective design detection: paste a run table, get a live diagnosis. */
export function Retrospective() {
  const router = useRouter();
  const [model, setModel] = useState<RetroTableModel>(emptyModel);
  const [name, setName] = useState("");

  const debouncedModel = useDebouncedValue(model, DEBOUNCE_MS);

  // Gate: only diagnose with ≥1 factor, ≥1 response and ≥3 rows with factors.
  const diagnoseBody = useMemo<RetroDiagnoseRequest | null>(() => {
    const hasFactor = debouncedModel.factorCols.length >= 1;
    const hasResponse = debouncedModel.responseCols.length >= 1;
    const enoughRows = countRowsWithFactors(debouncedModel) >= 3;
    if (!hasFactor || !hasResponse || !enoughRows) return null;
    return toDiagnoseRequest(debouncedModel);
  }, [debouncedModel]);

  const diagnose = useDiagnose(diagnoseBody);
  const materialize = useMaterialize();

  /** Append completion runs (natural values) as new rows in the grid. */
  function handleAddRuns(runs: Record<string, number | string>[]) {
    setModel((prev) => {
      const width = columnCount(prev);
      const newRows = runs.map((run) => {
        const cells = Array.from({ length: width }, () => "");
        prev.factorCols.forEach((col, i) => {
          const v = run[col.name];
          if (v !== undefined) cells[i] = String(v);
        });
        return cells;
      });
      return { ...prev, rows: [...prev.rows, ...newRows] };
    });
  }

  function handleImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setModel(parseCsv(text));
    };
    reader.readAsText(file);
  }

  function handleAnalyze() {
    const diagnosis = diagnose.data;
    if (!diagnosis?.best_model) return;
    const materializeName =
      name.trim() || `Análise retrospectiva ${new Date().toLocaleDateString("pt-BR")}`;
    const body = toDiagnoseRequest(debouncedModel, diagnosis.response_used ?? undefined);
    materialize.mutate(
      {
        name: materializeName,
        factors: body.factors,
        responses: body.responses,
        rows: body.rows,
        response_name: diagnosis.response_used ?? undefined,
      },
      {
        onSuccess: (result) => {
          const params = new URLSearchParams();
          if (diagnosis.best_model) params.set("model", diagnosis.best_model);
          if (diagnosis.response_used)
            params.set("response", diagnosis.response_used);
          const qs = params.toString();
          router.push(
            `/experiments/${result.experiment_id}/analysis${qs ? `?${qs}` : ""}`,
          );
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Callout label="Como usar">
        Marque cada coluna como fator ou resposta. Assim que houver pelo menos 1
        fator, 1 resposta e 3 linhas com valores, o diagnóstico à direita aparece
        sozinho: qual planejamento seus dados formam, quais modelos dá para
        ajustar e como completar o desenho.
      </Callout>
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface-1 p-5 shadow-lg">
            <label
              htmlFor="retro-name"
              className="mb-1 block text-xs uppercase tracking-wide text-muted"
            >
              Nome do experimento
            </label>
            <input
              id="retro-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Módulo de Resiliência — fibra × cimento"
              className="w-full rounded-md border border-border-strong bg-surface-0 px-3 py-2 text-sm text-foreground-strong outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <RetroGrid
          model={model}
          onChange={setModel}
          onImportFile={handleImportFile}
        />
      </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <RetroDiagnosisCard
            diagnosis={diagnose.data}
            isLoading={diagnose.isFetching}
            onAddRuns={handleAddRuns}
            onAnalyze={handleAnalyze}
            isAnalyzing={materialize.isPending}
            analyzeError={
              materialize.error instanceof Error
                ? materialize.error.message
                : diagnose.isError && diagnose.error instanceof Error
                  ? diagnose.error.message
                  : null
            }
          />
        </div>
      </div>
    </div>
  );
}

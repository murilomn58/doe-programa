"use client";

import type { DesignType } from "@/domain/design";

interface DesignPickerProps {
  designType: DesignType;
  replicates: number;
  onReplicatesChange: (replicates: number) => void;
  factorCount: number;
  runCount: number;
}

const inputClass =
  "rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

export function DesignPicker({
  designType,
  replicates,
  onReplicatesChange,
  factorCount,
  runCount,
}: DesignPickerProps) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
      <h2 className="mb-4 text-lg font-medium text-slate-200">Planejamento</h2>

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-300">Tipo de design</span>
          <select
            value={designType}
            disabled
            className={`${inputClass} cursor-not-allowed opacity-70`}
          >
            <option value="full_factorial_2k">
              Fatorial completo 2^k
            </option>
          </select>
        </label>

        <label className="flex w-40 flex-col gap-1 text-sm">
          <span className="text-slate-300">Réplicas</span>
          <input
            type="number"
            min={1}
            max={20}
            value={replicates}
            onChange={(e) =>
              onReplicatesChange(Math.max(1, Number(e.target.value) || 1))
            }
            className={inputClass}
          />
        </label>

        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-4">
          <p className="text-sm text-slate-300">
            {factorCount} fatores × 2 níveis = 2
            <sup>{factorCount}</sup> ={" "}
            <span className="font-mono text-cyan-400">
              {factorCount >= 1 ? 2 ** factorCount : 0}
            </span>{" "}
            combinações × {replicates} réplica(s)
          </p>
          <p className="mt-1 text-sm text-slate-200">
            Número de ensaios:{" "}
            <span className="font-mono text-lg font-semibold text-cyan-400">
              {runCount}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

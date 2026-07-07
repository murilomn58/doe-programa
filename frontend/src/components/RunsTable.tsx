"use client";

import type { GeneratedDesign, RunCellRead } from "@/domain/design";

interface RunsTableProps {
  design: GeneratedDesign;
}

function cellDisplay(cell: RunCellRead | undefined): string {
  if (!cell) return "";
  if (cell.label !== null && cell.label !== undefined) return cell.label;
  if (cell.natural !== null && cell.natural !== undefined) {
    return String(cell.natural);
  }
  return String(cell.coded);
}

const th =
  "border-b border-slate-700 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400";
const td = "border-b border-slate-800 px-3 py-2 font-mono text-sm text-slate-200";

export function RunsTable({ design }: RunsTableProps) {
  const factorNames = design.factors.map((f) => f.name);
  const runs = [...design.runs].sort((a, b) => a.run_order - b.run_order);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-medium text-slate-200">
          Matriz de ensaios
        </h2>
        <span className="font-mono text-xs text-slate-500">
          #{design.experiment_id} · {design.n_runs} ensaios
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>Run Order</th>
              <th className={th}>Std Order</th>
              <th className={th}>Point Type</th>
              <th className={th}>Blocks</th>
              <th className={th}>Replicates</th>
              {design.factors.map((factor) => (
                <th key={`f-${factor.name}`} className={`${th} text-cyan-400`}>
                  {factor.name}
                  {factor.unit ? (
                    <span className="text-slate-500"> ({factor.unit})</span>
                  ) : null}
                </th>
              ))}
              {design.responses.map((response) => (
                <th
                  key={`r-${response.name}`}
                  className={`${th} text-blue-400`}
                >
                  {response.name}
                  {response.unit ? (
                    <span className="text-slate-500"> ({response.unit})</span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.run_order} className="hover:bg-slate-900/40">
                <td className={`${td} text-cyan-400`}>{run.run_order}</td>
                <td className={td}>{run.std_order}</td>
                <td className={td}>{run.point_type}</td>
                <td className={td}>{run.block}</td>
                <td className={td}>{run.replicate}</td>
                {factorNames.map((name) => {
                  const cell = run.factors[name];
                  return (
                    <td key={name} className={td}>
                      {cellDisplay(cell)}
                      <span className="ml-1 text-xs text-slate-500">
                        ({cell && cell.coded > 0 ? "+1" : "−1"})
                      </span>
                    </td>
                  );
                })}
                {design.responses.map((response) => (
                  <td
                    key={response.name}
                    className={`${td} text-slate-600`}
                  >
                    —
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Matriz somente-leitura. A entrada das respostas será feita na próxima
        etapa.
      </p>
    </div>
  );
}

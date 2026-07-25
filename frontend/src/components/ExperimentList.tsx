import Link from "next/link";

import type { Experiment } from "@/domain/experiment";

interface ExperimentListProps {
  experiments: Experiment[];
  isLoading: boolean;
  errorMessage: string | null;
}

export function ExperimentList({
  experiments,
  isLoading,
  errorMessage,
}: ExperimentListProps) {
  if (isLoading) {
    return <p className="text-sm text-muted">Carregando…</p>;
  }

  if (errorMessage) {
    return (
      <p className="text-sm text-danger">
        Erro ao carregar experimentos: {errorMessage}
      </p>
    );
  }

  if (experiments.length === 0) {
    return (
      <p className="text-sm text-muted">
        Nenhum experimento ainda. Crie o primeiro acima.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {experiments.map((experiment) => (
        <li key={experiment.id}>
          <div className="rounded-lg border border-border bg-surface-1 p-4 transition hover:border-accent-strong/60">
            <Link href={`/experiments/${experiment.id}`} className="block">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-medium text-foreground-strong">{experiment.name}</h3>
                <span className="font-mono text-xs text-faint">
                  #{experiment.id}
                </span>
              </div>
              {experiment.description ? (
                <p className="mt-1 text-sm text-muted">
                  {experiment.description}
                </p>
              ) : null}
              <p className="mt-2 font-mono text-xs text-accent-mid/70">
                {new Date(experiment.created_at).toLocaleString("pt-BR")}
              </p>
            </Link>
            <div className="mt-3 flex gap-2 border-t border-border-subtle pt-3 text-sm">
              <Link
                href={`/experiments/${experiment.id}`}
                className="rounded-md border border-border px-3 py-1 text-foreground-soft transition hover:bg-surface-2"
              >
                Dados
              </Link>
              <Link
                href={`/experiments/${experiment.id}/analysis`}
                className="rounded-md border border-border px-3 py-1 text-foreground-soft transition hover:bg-surface-2"
              >
                Análise
              </Link>
              <Link
                href={`/experiments/${experiment.id}/edit`}
                className="rounded-md border border-border px-3 py-1 text-foreground-soft transition hover:bg-surface-2"
              >
                Editar
              </Link>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

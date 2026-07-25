import { use } from "react";

import { EditExperiment } from "@/containers/EditExperiment";

export default function ExperimentEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const experimentId = Number(id);
  if (!Number.isFinite(experimentId) || experimentId <= 0) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-danger">Experimento inválido.</p>
      </main>
    );
  }
  return <EditExperiment experimentId={experimentId} />;
}

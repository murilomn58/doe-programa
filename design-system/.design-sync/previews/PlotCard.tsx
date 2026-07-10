import { PlotCard } from "doe-design-system";

/** Placeholder do gráfico — Plotly não entra no pacote de design-system. */
function PlotPlaceholder() {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border bg-surface-2/40 text-xs text-muted">
      — gráfico interativo (Plotly) —
    </div>
  );
}

/** Canônico: moldura com menu de export (busy false). */
export function SuperficieComExport() {
  return (
    <div className="max-w-2xl bg-surface-0 p-4">
      <PlotCard
        title="Superfície de Resposta — Módulo de Resiliência (MPa)"
        hint="% Fibra × % Cimento"
        exportOptions={{ onExport: () => {}, busy: false }}
      >
        <PlotPlaceholder />
      </PlotCard>
    </div>
  );
}

/** Sem exportOptions: nenhum botão de export renderizado. */
export function EfeitosSemExport() {
  return (
    <div className="max-w-2xl bg-surface-0 p-4">
      <PlotCard
        title="Efeitos Principais — Módulo de Resiliência (MPa)"
        hint="n = 8 ensaios · 2 réplicas"
      >
        <PlotPlaceholder />
      </PlotCard>
    </div>
  );
}

/** Estado ocupado: export em andamento desabilita o botão. */
export function ParetoExportando() {
  return (
    <div className="max-w-2xl bg-surface-0 p-4">
      <PlotCard
        title="Gráfico de Pareto — Módulo de Resiliência (MPa)"
        hint="efeitos padronizados (α = 0.05)"
        exportOptions={{ onExport: () => {}, busy: true }}
      >
        <PlotPlaceholder />
      </PlotCard>
    </div>
  );
}

/** Corpo mais alto via bodyClassName para gráficos 3D. */
export function ContornoCorpoAlto() {
  return (
    <div className="max-w-2xl bg-surface-0 p-4">
      <PlotCard
        title="Contorno — Módulo de Resiliência (MPa)"
        hint="% Fibra (0 – 1.5) × % Cimento (4 – 7)"
        bodyClassName="h-96"
        exportOptions={{
          onExport: () => {},
          formats: ["png", "svg"],
          busy: false,
        }}
      >
        <PlotPlaceholder />
      </PlotCard>
    </div>
  );
}

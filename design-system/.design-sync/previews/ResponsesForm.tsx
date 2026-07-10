import { ResponsesForm } from "doe-design-system";

const noop = () => {};

export function RespostaPreenchida() {
  return (
    <div className="max-w-2xl bg-surface-0 p-6">
      <ResponsesForm
        responses={[{ name: "Módulo de Resiliência", unit: "MPa" }]}
        onChange={noop}
        onAdd={noop}
        onRemove={noop}
      />
    </div>
  );
}

export function MultiplasRespostas() {
  return (
    <div className="max-w-2xl bg-surface-0 p-6">
      <ResponsesForm
        responses={[
          { name: "Módulo de Resiliência", unit: "MPa" },
          { name: "Deformação Permanente", unit: "mm" },
          { name: "Resistência à Tração", unit: "kPa" },
        ]}
        onChange={noop}
        onAdd={noop}
        onRemove={noop}
      />
    </div>
  );
}

export function SemUnidade() {
  return (
    <div className="max-w-2xl bg-surface-0 p-6">
      <ResponsesForm
        responses={[{ name: "Índice de Suporte Califórnia" }]}
        onChange={noop}
        onAdd={noop}
        onRemove={noop}
      />
    </div>
  );
}

export function Vazio() {
  return (
    <div className="max-w-2xl bg-surface-0 p-6">
      <ResponsesForm responses={[]} onChange={noop} onAdd={noop} onRemove={noop} />
    </div>
  );
}

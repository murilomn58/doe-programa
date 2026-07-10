import { FactorForm } from "doe-design-system";

const noop = () => {};

const fatoresDaAula = [
  {
    name: "% Fibra",
    factor_type: "quantitative" as const,
    unit: "%",
    low: 0,
    high: 1.5,
  },
  {
    name: "% Cimento",
    factor_type: "quantitative" as const,
    unit: "%",
    low: 4,
    high: 7,
  },
];

const fatoresComQualitativo = [
  ...fatoresDaAula,
  {
    name: "Tipo de fibra",
    factor_type: "qualitative" as const,
    low_label: "Tucum",
    high_label: "Piassava",
  },
];

const fatorRecemAdicionado = [
  {
    name: "",
    factor_type: "quantitative" as const,
  },
];

/** Caso canônico da aula: dois fatores quantitativos preenchidos (% Fibra 0/1.5 e % Cimento 4/7). */
export function DoisFatoresQuantitativos() {
  return (
    <div className="bg-surface-0 p-6">
      <FactorForm
        factors={fatoresDaAula}
        onChange={noop}
        onAdd={noop}
        onRemove={noop}
      />
    </div>
  );
}

/** Mistura quantitativo + qualitativo: o fator C troca níveis numéricos por rótulos (Tucum/Piassava). */
export function ComFatorQualitativo() {
  return (
    <div className="bg-surface-0 p-6">
      <FactorForm
        factors={fatoresComQualitativo}
        onChange={noop}
        onAdd={noop}
        onRemove={noop}
      />
    </div>
  );
}

/** Estado inicial: fator recém-adicionado, ainda sem nome, unidade ou níveis. */
export function FatorRecemAdicionado() {
  return (
    <div className="bg-surface-0 p-6">
      <FactorForm
        factors={fatorRecemAdicionado}
        onChange={noop}
        onAdd={noop}
        onRemove={noop}
      />
    </div>
  );
}

/** Lista vazia: apenas o contador "0 fator(es)" e o botão de adicionar. */
export function SemFatores() {
  return (
    <div className="bg-surface-0 p-6">
      <FactorForm factors={[]} onChange={noop} onAdd={noop} onRemove={noop} />
    </div>
  );
}

import { ModelBuilder } from "doe-design-system";

const RESPOSTAS = ["Módulo de Resiliência (MPa)", "Deformação Permanente (mm)"];

/** Canônico: modelo linear + interações com termos principais e interação 2 a 2. */
export function LinearComInteracoes() {
  return (
    <div className="bg-surface-0 p-6">
      <ModelBuilder
        responses={RESPOSTAS}
        selectedResponse="Módulo de Resiliência (MPa)"
        onSelectResponse={() => {}}
        model="linear_interactions"
        onSelectModel={() => {}}
        terms={[
          { label: "% Fibra", kind: "main" },
          { label: "% Cimento", kind: "main" },
          { label: "% Fibra*% Cimento", kind: "interaction" },
        ]}
      />
    </div>
  );
}

/** Modelo linear: somente efeitos principais. */
export function LinearSimples() {
  return (
    <div className="bg-surface-0 p-6">
      <ModelBuilder
        responses={RESPOSTAS}
        selectedResponse="Módulo de Resiliência (MPa)"
        onSelectResponse={() => {}}
        model="linear"
        onSelectModel={() => {}}
        terms={[
          { label: "% Fibra", kind: "main" },
          { label: "% Cimento", kind: "main" },
        ]}
      />
    </div>
  );
}

/** Modelo completo: principais + interações + quadráticos (CCD com 3 fatores). */
export function ModeloCompleto() {
  return (
    <div className="bg-surface-0 p-6">
      <ModelBuilder
        responses={RESPOSTAS}
        selectedResponse="Deformação Permanente (mm)"
        onSelectResponse={() => {}}
        model="full"
        onSelectModel={() => {}}
        terms={[
          { label: "% Fibra", kind: "main" },
          { label: "% Cimento", kind: "main" },
          { label: "Teor de Umidade", kind: "main" },
          { label: "% Fibra*% Cimento", kind: "interaction" },
          { label: "% Fibra*Teor de Umidade", kind: "interaction" },
          { label: "% Cimento*Teor de Umidade", kind: "interaction" },
          { label: "% Fibra^2", kind: "quadratic" },
          { label: "% Cimento^2", kind: "quadratic" },
          { label: "Teor de Umidade^2", kind: "quadratic" },
        ]}
      />
    </div>
  );
}

/** Estado vazio: experimento sem respostas definidas e sem termos. */
export function SemRespostas() {
  return (
    <div className="bg-surface-0 p-6">
      <ModelBuilder
        responses={[]}
        selectedResponse={null}
        onSelectResponse={() => {}}
        model="linear"
        onSelectModel={() => {}}
        terms={[]}
      />
    </div>
  );
}

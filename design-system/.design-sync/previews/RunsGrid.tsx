import { RunsGrid } from "doe-design-system";

/* ---------- Dados do domínio: solo-fibra-cimento, fatorial 2² com 2 réplicas ---------- */

const fatores = [
  {
    id: 1,
    name: "% Fibra",
    factor_type: "quantitative" as const,
    unit: "%",
    position: 0,
    levels: [
      { coded_value: -1, natural_value: 0, label: null },
      { coded_value: 1, natural_value: 1.5, label: null },
    ],
  },
  {
    id: 2,
    name: "% Cimento",
    factor_type: "quantitative" as const,
    unit: "%",
    position: 1,
    levels: [
      { coded_value: -1, natural_value: 4, label: null },
      { coded_value: 1, natural_value: 7, label: null },
    ],
  },
];

const respostaMR = [
  { id: 1, name: "Módulo de Resiliência", unit: "MPa", position: 0 },
];

function ensaio(
  id: number,
  runOrder: number,
  stdOrder: number,
  replicate: number,
  fibra: -1 | 1,
  cimento: -1 | 1,
  valores: Record<string, number | null>,
) {
  return {
    id,
    run_order: runOrder,
    std_order: stdOrder,
    point_type: 1,
    block: 1,
    replicate,
    factors: {
      "% Fibra": { coded: fibra, natural: fibra === 1 ? 1.5 : 0, label: null },
      "% Cimento": { coded: cimento, natural: cimento === 1 ? 7 : 4, label: null },
    },
    response_values: valores,
  };
}

/** Matriz 2² com 2 réplicas (8 ensaios) — réplica 2 ainda sem medições. */
const ensaiosParciais = [
  ensaio(1, 1, 2, 1, 1, -1, { "Módulo de Resiliência": 2895 }),
  ensaio(2, 2, 1, 1, -1, -1, { "Módulo de Resiliência": 2510 }),
  ensaio(3, 3, 4, 1, 1, 1, { "Módulo de Resiliência": 3980 }),
  ensaio(4, 4, 3, 1, -1, 1, { "Módulo de Resiliência": 3420 }),
  ensaio(5, 5, 6, 2, 1, -1, { "Módulo de Resiliência": 2940 }),
  ensaio(6, 6, 5, 2, -1, -1, { "Módulo de Resiliência": null }),
  ensaio(7, 7, 8, 2, 1, 1, { "Módulo de Resiliência": null }),
  ensaio(8, 8, 7, 2, -1, 1, { "Módulo de Resiliência": null }),
];

/** Mesma matriz com todas as respostas medidas. */
const ensaiosCompletos = [
  ensaio(1, 1, 2, 1, 1, -1, { "Módulo de Resiliência": 2895 }),
  ensaio(2, 2, 1, 1, -1, -1, { "Módulo de Resiliência": 2510 }),
  ensaio(3, 3, 4, 1, 1, 1, { "Módulo de Resiliência": 3980 }),
  ensaio(4, 4, 3, 1, -1, 1, { "Módulo de Resiliência": 3420 }),
  ensaio(5, 5, 6, 2, 1, -1, { "Módulo de Resiliência": 2940 }),
  ensaio(6, 6, 5, 2, -1, -1, { "Módulo de Resiliência": 2465 }),
  ensaio(7, 7, 8, 2, 1, 1, { "Módulo de Resiliência": 4050 }),
  ensaio(8, 8, 7, 2, -1, 1, { "Módulo de Resiliência": 3505 }),
];

const duasRespostas = [
  { id: 1, name: "Módulo de Resiliência", unit: "MPa", position: 0 },
  { id: 2, name: "Deformação Permanente", unit: "mm", position: 1 },
];

/** 2² sem réplica com duas variáveis de resposta, parcialmente medidas. */
const ensaiosDuasRespostas = [
  ensaio(1, 1, 1, 1, -1, -1, {
    "Módulo de Resiliência": 2510,
    "Deformação Permanente": 9.04,
  }),
  ensaio(2, 2, 2, 1, 1, -1, {
    "Módulo de Resiliência": 2895,
    "Deformação Permanente": 6.27,
  }),
  ensaio(3, 3, 3, 1, -1, 1, {
    "Módulo de Resiliência": 3420,
    "Deformação Permanente": null,
  }),
  ensaio(4, 4, 4, 1, 1, 1, {
    "Módulo de Resiliência": 3980,
    "Deformação Permanente": null,
  }),
];

const noop = () => {};

/* ---------- Stories ---------- */

/** Canônico: matriz 2² com 2 réplicas e respostas parcialmente preenchidas. */
export function PreenchimentoParcial() {
  return (
    <div className="bg-surface-0 p-6">
      <RunsGrid
        factors={fatores}
        responses={respostaMR}
        runs={ensaiosParciais}
        onSave={noop}
        isSaving={false}
        saveError={null}
        savedAt={null}
      />
    </div>
  );
}

/** Todas as respostas medidas e persistidas — feedback verde de salvamento. */
export function TodasRespostasSalvas() {
  return (
    <div className="bg-surface-0 p-6">
      <RunsGrid
        factors={fatores}
        responses={respostaMR}
        runs={ensaiosCompletos}
        onSave={noop}
        isSaving={false}
        saveError={null}
        savedAt={1720000000000}
      />
    </div>
  );
}

/** Salvamento em andamento — botão desabilitado com rótulo "Salvando…". */
export function SalvandoRespostas() {
  return (
    <div className="bg-surface-0 p-6">
      <RunsGrid
        factors={fatores}
        responses={respostaMR}
        runs={ensaiosParciais}
        onSave={noop}
        isSaving={true}
        saveError={null}
        savedAt={null}
      />
    </div>
  );
}

/** Falha de persistência — mensagem de erro em vermelho junto ao rodapé. */
export function ErroAoSalvar() {
  return (
    <div className="bg-surface-0 p-6">
      <RunsGrid
        factors={fatores}
        responses={respostaMR}
        runs={ensaiosParciais}
        onSave={noop}
        isSaving={false}
        saveError="Falha ao salvar as respostas: não foi possível conectar ao servidor."
        savedAt={null}
      />
    </div>
  );
}

/** Estado vazio: experimento ainda sem variáveis de resposta definidas. */
export function SemVariaveisDeResposta() {
  return (
    <div className="bg-surface-0 p-6">
      <RunsGrid
        factors={fatores}
        responses={[]}
        runs={ensaiosParciais}
        onSave={noop}
        isSaving={false}
        saveError={null}
        savedAt={null}
      />
    </div>
  );
}

/** Composição realista: duas variáveis de resposta lado a lado na mesma grade. */
export function DuasRespostas() {
  return (
    <div className="bg-surface-0 p-6">
      <RunsGrid
        factors={fatores}
        responses={duasRespostas}
        runs={ensaiosDuasRespostas}
        onSave={noop}
        isSaving={false}
        saveError={null}
        savedAt={null}
      />
    </div>
  );
}

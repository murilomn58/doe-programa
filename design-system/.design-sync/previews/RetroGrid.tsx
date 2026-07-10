import { RetroGrid } from "doe-design-system";

const noop = () => {};

/** Fatorial 2³ completo do exemplo solo-fibra-cimento: 3 fatores, 8 ensaios. */
const modelo2aoCubo = {
  factorCols: [
    { name: "% Fibra", type: "quantitative" as const, unit: "%" },
    { name: "% Cimento", type: "quantitative" as const, unit: "%" },
    { name: "Tempo de Cura (dias)", type: "auto" as const },
  ],
  responseCols: [{ name: "Módulo de Resiliência (MPa)", unit: "MPa" }],
  rows: [
    ["0", "4", "7", "182,5"],
    ["1,5", "4", "7", "210,3"],
    ["0", "7", "7", "265,4"],
    ["1,5", "7", "7", "301,2"],
    ["0", "4", "28", "248,7"],
    ["1,5", "4", "28", "276,9"],
    ["0", "7", "28", "342,8"],
    ["1,5", "7", "28", "398,6"],
  ],
};

/** Golden test da aula (OriginPro): 2² com 2 réplicas, fator qualitativo e duas respostas. */
const modeloDuasRespostas = {
  factorCols: [
    { name: "Condição de Compactação", type: "quantitative" as const },
    { name: "Par de Tensão", type: "qualitative" as const },
  ],
  responseCols: [{ name: "DP_10000" }, { name: "DP_50000" }],
  rows: [
    ["19", "(70,70)", "3.448", "3.475"],
    ["18", "(70,70)", "0.591", "0.612"],
    ["19", "(210,70)", "8.972", "9.041"],
    ["18", "(210,70)", "5.094", "5.168"],
    ["18", "(70,70)", "0.634", "0.645"],
    ["19", "(70,70)", "1.599", "1.623"],
    ["19", "(210,70)", "6.204", "6.270"],
    ["18", "(210,70)", "3.334", "3.447"],
  ],
};

/** Digitação em andamento: fatores preenchidos, respostas ainda incompletas. */
const modeloParcial = {
  factorCols: [
    { name: "% Fibra", type: "quantitative" as const, unit: "%" },
    { name: "% Cimento", type: "quantitative" as const, unit: "%" },
  ],
  responseCols: [{ name: "Módulo de Resiliência (MPa)", unit: "MPa" }],
  rows: [
    ["0", "4", "182,5"],
    ["1,5", "4", "210,3"],
    ["0", "7", ""],
    ["1,5", "7", ""],
  ],
};

/** Estado inicial da análise retrospectiva: colunas padrão e células em branco. */
const modeloVazio = {
  factorCols: [
    { name: "X1", type: "auto" as const },
    { name: "X2", type: "auto" as const },
  ],
  responseCols: [{ name: "Y" }],
  rows: [
    ["", "", ""],
    ["", "", ""],
    ["", "", ""],
    ["", "", ""],
  ],
};

/** Caso canônico: grade 2³ completa (% Fibra 0/1,5 · % Cimento 4/7 · Tempo de Cura 7/28) com Módulo de Resiliência preenchido. */
export function GradeFatorial2aoCubo() {
  return (
    <div className="bg-surface-0 p-6">
      <RetroGrid model={modelo2aoCubo} onChange={noop} onImportFile={noop} />
    </div>
  );
}

/** Duas respostas (DP_10000 e DP_50000) com fator qualitativo Par de Tensão — dados do golden test da aula. */
export function GradeComDuasRespostas() {
  return (
    <div className="bg-surface-0 p-6">
      <RetroGrid
        model={modeloDuasRespostas}
        onChange={noop}
        onImportFile={noop}
      />
    </div>
  );
}

/** Respostas parcialmente preenchidas: ensaios ainda sem Módulo de Resiliência medido. */
export function GradeParcialmentePreenchida() {
  return (
    <div className="bg-surface-0 p-6">
      <RetroGrid model={modeloParcial} onChange={noop} onImportFile={noop} />
    </div>
  );
}

/** Grade vazia recém-criada: colunas padrão X1/X2/Y aguardando colagem do Excel ou importação de CSV. */
export function GradeVazia() {
  return (
    <div className="bg-surface-0 p-6">
      <RetroGrid model={modeloVazio} onChange={noop} onImportFile={noop} />
    </div>
  );
}

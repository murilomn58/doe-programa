import { FactorPairSelector } from "doe-design-system";

const paresTresFatores: string[][] = [
  ["% Fibra", "% Cimento"],
  ["% Fibra", "Tempo de Cura (dias)"],
  ["% Cimento", "Tempo de Cura (dias)"],
];

const paresQuatroFatores: string[][] = [
  ["% Fibra", "% Cimento"],
  ["% Fibra", "Tempo de Cura (dias)"],
  ["% Fibra", "Umidade (%)"],
  ["% Cimento", "Tempo de Cura (dias)"],
  ["% Cimento", "Umidade (%)"],
  ["Tempo de Cura (dias)", "Umidade (%)"],
];

/** Canônico: 3 fatores (3 pares) com o par % Fibra × % Cimento selecionado. */
export function ParSelecionado() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-1 p-4">
      <span className="text-xs text-muted">Par de fatores:</span>
      <FactorPairSelector
        pairs={paresTresFatores}
        selected={["% Fibra", "% Cimento"]}
        onSelect={() => {}}
      />
    </div>
  );
}

/** Sem seleção explícita (selected = null): cai no primeiro par da lista. */
export function SelecaoPadrao() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-1 p-4">
      <span className="text-xs text-muted">Par de fatores (padrão):</span>
      <FactorPairSelector
        pairs={paresTresFatores}
        selected={null}
        onSelect={() => {}}
      />
    </div>
  );
}

/** 4 fatores geram 6 pares; par do meio selecionado. */
export function QuatroFatores() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-1 p-4">
      <span className="text-xs text-muted">6 pares possíveis:</span>
      <FactorPairSelector
        pairs={paresQuatroFatores}
        selected={["% Cimento", "Tempo de Cura (dias)"]}
        onSelect={() => {}}
      />
    </div>
  );
}

/** Com apenas 1 par possível (2 fatores), o seletor não renderiza nada. */
export function ParUnicoNaoRenderiza() {
  return (
    <div className="rounded-lg border border-border bg-surface-1 p-4">
      <p className="mb-2 text-xs text-muted">
        Experimento 2² (apenas % Fibra × % Cimento): há um único par possível, então o
        seletor não aparece — o espaço abaixo fica vazio de propósito.
      </p>
      <FactorPairSelector
        pairs={[["% Fibra", "% Cimento"]]}
        selected={null}
        onSelect={() => {}}
      />
    </div>
  );
}

/** Composição realista: seletor no cabeçalho de um card de superfície de resposta. */
export function CabecalhoDeGrafico() {
  return (
    <div className="rounded-lg border border-border bg-surface-1">
      <div className="flex items-center justify-between gap-4 border-b border-border-subtle px-4 py-3">
        <h3 className="text-sm font-medium text-foreground-strong">
          Superfície de Resposta — Módulo de Resiliência (MPa)
        </h3>
        <FactorPairSelector
          pairs={paresTresFatores}
          selected={["% Cimento", "Tempo de Cura (dias)"]}
          onSelect={() => {}}
        />
      </div>
      <div className="flex h-40 items-center justify-center text-xs text-faint">
        Área do gráfico 3D (Plotly) — Z calculado no backend
      </div>
    </div>
  );
}

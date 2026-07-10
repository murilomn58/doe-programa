import { AliasingReport } from "doe-design-system";

/**
 * Fração 2^(4-1), Resolução IV — caso canônico de triagem de mistura
 * solo-fibra-cimento: A = % Fibra, B = % Cimento, C = Tempo de cura,
 * D = Energia de compactação.
 */
export function FracaoMeiaResolucaoIV() {
  return (
    <div className="max-w-2xl p-6">
      <AliasingReport
        resolution={4}
        aliasing={[
          "I = ABCD",
          "A = BCD",
          "B = ACD",
          "C = ABD",
          "D = ABC",
          "AB = CD",
          "AC = BD",
          "AD = BC",
        ]}
      />
    </div>
  );
}

/** Fração 2^(3-1), Resolução III — triagem saturada (badge de alerta). */
export function TriagemResolucaoIII() {
  return (
    <div className="max-w-2xl p-6">
      <AliasingReport
        resolution={3}
        aliasing={["I = ABC", "A = BC", "B = AC", "C = AB"]}
      />
    </div>
  );
}

/** Fração 2^(5-1), Resolução V — interações de 2 fatores estimáveis. */
export function FracaoResolucaoV() {
  return (
    <div className="max-w-2xl p-6">
      <AliasingReport
        resolution={5}
        aliasing={[
          "I = ABCDE",
          "A = BCDE",
          "B = ACDE",
          "C = ABDE",
          "D = ABCE",
          "E = ABCD",
          "AB = CDE",
          "AC = BDE",
          "AD = BCE",
          "AE = BCD",
          "BC = ADE",
          "BD = ACE",
          "BE = ACD",
          "CD = ABE",
          "CE = ABD",
          "DE = ABC",
        ]}
      />
    </div>
  );
}

/** Estado vazio — fatorial completo sem confundimento (sem badge nem aliases). */
export function SemConfundimento() {
  return (
    <div className="max-w-2xl p-6">
      <AliasingReport resolution={null} aliasing={[]} />
    </div>
  );
}

/**
 * Composição realista: relatório lado a lado com a legenda dos fatores do
 * experimento de Módulo de Resiliência (MPa).
 */
export function ComLegendaDeFatores() {
  return (
    <div className="grid max-w-4xl gap-4 p-6 md:grid-cols-[2fr_1fr]">
      <AliasingReport
        resolution={4}
        aliasing={[
          "I = ABCD",
          "A = BCD",
          "B = ACD",
          "C = ABD",
          "D = ABC",
          "AB = CD",
          "AC = BD",
          "AD = BC",
        ]}
      />
      <div className="rounded-xl border border-border bg-surface-1 p-4">
        <h3 className="mb-3 text-sm font-medium text-foreground">
          Fatores do experimento
        </h3>
        <ul className="space-y-2 text-xs text-muted">
          <li>
            <span className="font-mono text-accent">A</span> — % Fibra (0 / 1.5)
          </li>
          <li>
            <span className="font-mono text-accent">B</span> — % Cimento (4 / 7)
          </li>
          <li>
            <span className="font-mono text-accent">C</span> — Tempo de cura
            (7 / 28 dias)
          </li>
          <li>
            <span className="font-mono text-accent">D</span> — Energia de
            compactação (normal / modificada)
          </li>
        </ul>
        <p className="mt-3 text-xs text-faint">
          Resposta: Módulo de Resiliência (MPa)
        </p>
      </div>
    </div>
  );
}

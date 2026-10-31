/**
 * O método em 4 estações: onboarding visual do pesquisador (planejar,
 * executar, analisar, otimizar).
 *
 * Extraído sem alteração do antigo `Dashboard.tsx` (linhas 92 a 111), que
 * virou `Experimentos.tsx` na Task 1.5: marcação pura, sem lógica, que
 * qualquer página do programa pode reaproveitar.
 */

export function MetodoQuatroEstacoes() {
  return (
    <section
      aria-label="Como funciona"
      className="mt-8 rounded-xl border border-border bg-surface-1 px-6 py-5"
    >
      <svg
        viewBox="0 0 720 84"
        className="w-full"
        role="img"
        aria-label="Planejar, executar, analisar e otimizar"
      >
        {[
          { x: 40, label: "Planejar", hint: "fatores e matriz" },
          { x: 240, label: "Executar", hint: "ensaios no lab" },
          { x: 440, label: "Analisar", hint: "ANOVA e efeitos" },
          { x: 640, label: "Otimizar", hint: "ponto ótimo" },
        ].map((s, i) => (
          <g key={s.label}>
            {i < 3 ? (
              <line
                x1={s.x + 44}
                y1={30}
                x2={s.x + 156}
                y2={30}
                stroke="var(--color-border-strong)"
                strokeWidth={1.5}
                strokeDasharray="5 4"
              />
            ) : null}
            <circle
              cx={s.x}
              cy={30}
              r={17}
              fill={i === 3 ? "var(--color-primary)" : "var(--color-surface-0)"}
              stroke={i === 3 ? "var(--color-primary)" : "var(--color-accent-mid)"}
              strokeWidth={1.6}
            />
            <text
              x={s.x}
              y={35}
              textAnchor="middle"
              fontSize={13}
              fontWeight={600}
              fill={i === 3 ? "#ffffff" : "var(--color-accent-strong)"}
            >
              {i + 1}
            </text>
            <text x={s.x} y={64} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--color-foreground)">
              {s.label}
            </text>
            <text x={s.x} y={79} textAnchor="middle" fontSize={11} fill="var(--color-muted)">
              {s.hint}
            </text>
          </g>
        ))}
      </svg>
    </section>
  );
}

/** Indicador de passos do wizard (1. Fatores · 2. Design). Passos concluídos são clicáveis. */

interface StepNavProps {
  steps: string[];
  active: number;
  /** Navega para um passo (só permitido se já alcançado). */
  onStep?: (index: number) => void;
  /** Maior passo já alcançado (limita para onde dá para voltar/avançar). */
  maxReached?: number;
}

export function StepNav({ steps, active, onStep, maxReached }: StepNavProps) {
  const reachable = maxReached ?? active;
  return (
    <nav className="mb-6 flex items-center gap-3 text-sm">
      {steps.map((label, i) => {
        const canGo = onStep && i <= reachable;
        return (
          <div key={label} className="flex items-center gap-3">
            {i > 0 ? <span className="text-faint">·</span> : null}
            <button
              type="button"
              disabled={!canGo}
              onClick={() => canGo && onStep(i)}
              className={`transition ${
                i === active
                  ? "font-semibold text-accent-mid"
                  : canGo
                    ? "text-muted hover:text-foreground-soft"
                    : "cursor-default text-faint"
              }`}
            >
              {i + 1}. {label}
            </button>
          </div>
        );
      })}
    </nav>
  );
}

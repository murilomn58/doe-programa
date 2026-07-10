import { AnovaTable } from "doe-design-system";

/** ANOVA do exemplo da aula: fatorial 2² com 2 réplicas, modelo completo (efeitos + interação). */
const anovaModeloCompleto = [
  { source: "(1) % Fibra", ss: 37.56711, df: 1, ms: 37.56711, f: 21.21642, p: 0.009985 },
  { source: "(2) % Cimento", ss: 13.95504, df: 1, ms: 13.95504, f: 7.88126, p: 0.048447 },
  { source: "% Fibra × % Cimento", ss: 1.07311, df: 1, ms: 1.07311, f: 0.60605, p: 0.47976 },
];

const erroPuro = { source: "Erro Puro", ss: 7.08265, df: 4, ms: 1.77066, f: null, p: null };
const totalAula = { source: "Total", ss: 59.67792, df: 7, ms: null, f: null, p: null };

/** Canônico: ANOVA da aula (Módulo de Resiliência), dois efeitos significativos (p < 0.05). */
export function ExemploDaAula() {
  return (
    <div className="grid gap-3 p-4">
      <p className="text-sm text-foreground">
        Resposta: Módulo de Resiliência (MPa) — fatorial 2² com 2 réplicas
      </p>
      <AnovaTable
        rows={anovaModeloCompleto}
        pureError={erroPuro}
        lackOfFit={null}
        total={totalAula}
        rSquared={0.88132}
        adjRSquared={0.79231}
        msPureError={1.77066}
      />
    </div>
  );
}

/** Modelo só de efeitos principais: a interação omitida vira linha de Falta de Ajuste. */
export function ComFaltaDeAjuste() {
  return (
    <div className="grid gap-3 p-4">
      <p className="text-sm text-foreground">
        Modelo linear (efeitos principais) — Falta de Ajuste não significativa
      </p>
      <AnovaTable
        rows={[
          { source: "(1) % Fibra", ss: 37.56711, df: 1, ms: 37.56711, f: 21.21642, p: 0.009985 },
          { source: "(2) % Cimento", ss: 13.95504, df: 1, ms: 13.95504, f: 7.88126, p: 0.048447 },
        ]}
        pureError={erroPuro}
        lackOfFit={{ source: "Falta de Ajuste", ss: 1.07311, df: 1, ms: 1.07311, f: 0.60605, p: 0.47976 }}
        total={totalAula}
        rSquared={0.86334}
        adjRSquared={0.80868}
        msPureError={1.77066}
      />
    </div>
  );
}

/** Design saturado sem réplicas: sem graus de liberdade para F e p (travessões). */
export function SaturadaSemReplicas() {
  return (
    <div className="grid gap-3 p-4">
      <p className="text-sm text-foreground">
        Fatorial 2² sem réplicas — modelo saturado, sem teste F disponível
      </p>
      <AnovaTable
        rows={[
          { source: "(1) % Fibra", ss: 30.06438, df: 1, ms: 30.06438, f: null, p: null },
          { source: "(2) % Cimento", ss: 11.16403, df: 1, ms: 11.16403, f: null, p: null },
          { source: "% Fibra × % Cimento", ss: 0.85849, df: 1, ms: 0.85849, f: null, p: null },
        ]}
        pureError={null}
        lackOfFit={null}
        total={{ source: "Total", ss: 42.0869, df: 3, ms: null, f: null, p: null }}
        rSquared={1.0}
        adjRSquared={null}
        msPureError={null}
      />
    </div>
  );
}

/** Composição realista: ANOVA lado a lado para duas respostas do mesmo experimento. */
export function DuasRespostas() {
  return (
    <div className="grid gap-6 bg-surface-0 p-4 xl:grid-cols-2">
      <div className="grid gap-2">
        <h4 className="text-sm font-medium text-foreground">Módulo de Resiliência (MPa)</h4>
        <AnovaTable
          rows={anovaModeloCompleto}
          pureError={erroPuro}
          lackOfFit={null}
          total={totalAula}
          rSquared={0.88132}
          adjRSquared={0.79231}
          msPureError={1.77066}
        />
      </div>
      <div className="grid gap-2">
        <h4 className="text-sm font-medium text-foreground">Deformação Permanente (mm)</h4>
        <AnovaTable
          rows={[
            { source: "(1) % Fibra", ss: 13.87844, df: 1, ms: 13.87844, f: 8.61538, p: 0.03244 },
            { source: "(2) % Cimento", ss: 38.59234, df: 1, ms: 38.59234, f: 23.95706, p: 0.0045 },
          ]}
          pureError={{ source: "Resíduo", ss: 8.05479, df: 5, ms: 1.61096, f: null, p: null }}
          lackOfFit={null}
          total={{ source: "Total", ss: 60.52557, df: 7, ms: null, f: null, p: null }}
          rSquared={0.86692}
          adjRSquared={0.81369}
          msPureError={null}
        />
      </div>
    </div>
  );
}

import { DesignPicker } from "doe-design-system";

type DesignPickerProps = Parameters<typeof DesignPicker>[0];
type Config = DesignPickerProps["config"];

/** Config base (espelha o defaultDesignConfig do app). */
const BASE: Config = {
  designType: "full_factorial_2k",
  fractionalMode: "resolution",
  fractionalResolution: 3,
  fractionalGenerators: "",
  ccdVariant: "rotatable",
  ccdCenterFactorial: 4,
  ccdCenterAxial: 4,
  bbdCenter: 3,
  centerPoints: 0,
  taguchiArray: "",
  taguchiSN: "larger_is_better",
  taguchiLevels: 2,
  optimalCriterion: "D",
  optimalNRuns: 0,
  optimalModel: "linear_interactions",
  dsdExtraRuns: 0,
};

/** Catálogo de arranjos ortogonais (como servido por GET /designs/taguchi-catalog). */
const CATALOGO_TAGUCHI: NonNullable<DesignPickerProps["taguchiArrays"]> = [
  { name: "L4(2^3)", runs: 4, n_columns: 3, level_capacity: { 2: 3 } },
  { name: "L8(2^7)", runs: 8, n_columns: 7, level_capacity: { 2: 7 } },
  { name: "L9(3^4)", runs: 9, n_columns: 4, level_capacity: { 3: 4 } },
  { name: "L12(2^11)", runs: 12, n_columns: 11, level_capacity: { 2: 11 } },
  { name: "L16(2^15)", runs: 16, n_columns: 15, level_capacity: { 2: 15 } },
  { name: "L18(2^1 3^7)", runs: 18, n_columns: 8, level_capacity: { 2: 1, 3: 7 } },
  { name: "L27(3^13)", runs: 27, n_columns: 13, level_capacity: { 3: 13 } },
];

/** Canônico (aula): fatorial completo 2² — % Fibra (0 / 1,5) × % Cimento (4 / 7), 3 réplicas → 12 ensaios. */
export function FatorialCompletoCanonico() {
  return (
    <div className="flex max-w-2xl flex-col gap-3 bg-surface-0 p-6">
      <p className="text-sm text-muted">
        Fatores: % Fibra (0 / 1,5) e % Cimento (4 / 7) — resposta: Módulo de
        Resiliência (MPa).
      </p>
      <DesignPicker
        config={BASE}
        onConfigChange={() => {}}
        replicates={3}
        onReplicatesChange={() => {}}
        factorCount={2}
        hasQualitativeFactor={false}
      />
    </div>
  );
}

/** Fracionado 2^(k−p) por resolução III: triagem de 5 fatores em 8 corridas + 3 pontos centrais. */
export function FracionadoPorResolucao() {
  return (
    <div className="flex max-w-2xl flex-col gap-3 bg-surface-0 p-6">
      <p className="text-sm text-muted">
        Triagem de 5 fatores da mistura solo-fibra (% Fibra, % Cimento, Teor de
        Umidade, Energia de Compactação, Tempo de Cura).
      </p>
      <DesignPicker
        config={{
          ...BASE,
          designType: "fractional_factorial_2kp",
          fractionalMode: "resolution",
          fractionalResolution: 3,
          centerPoints: 3,
        }}
        onConfigChange={() => {}}
        replicates={1}
        onReplicatesChange={() => {}}
        factorCount={5}
        hasQualitativeFactor={false}
      />
    </div>
  );
}

/** Estado pedido: CCD selecionado — variantes (rotável/ortogonal/face-centrada) e preview do α = 1,414. */
export function CompostoCentralRotavel() {
  return (
    <div className="flex max-w-2xl flex-col gap-3 bg-surface-0 p-6">
      <p className="text-sm text-muted">
        RSM para otimizar o Módulo de Resiliência (MPa) em torno do ponto ótimo
        de % Fibra e % Cimento.
      </p>
      <DesignPicker
        config={{
          ...BASE,
          designType: "central_composite",
          ccdVariant: "rotatable",
          ccdCenterFactorial: 4,
          ccdCenterAxial: 4,
        }}
        onConfigChange={() => {}}
        replicates={1}
        onReplicatesChange={() => {}}
        factorCount={2}
        hasQualitativeFactor={false}
      />
    </div>
  );
}

/** Box-Behnken com 3 fatores quantitativos: 12 corridas + 3 pontos centrais = 15 ensaios. */
export function BoxBehnkenTresFatores() {
  return (
    <div className="flex max-w-2xl flex-col gap-3 bg-surface-0 p-6">
      <p className="text-sm text-muted">
        Superfície de resposta sem extrapolar a faixa dos fatores: % Fibra,
        % Cimento e Teor de Umidade.
      </p>
      <DesignPicker
        config={{
          ...BASE,
          designType: "box_behnken",
          bbdCenter: 3,
        }}
        onConfigChange={() => {}}
        replicates={1}
        onReplicatesChange={() => {}}
        factorCount={3}
        hasQualitativeFactor={false}
      />
    </div>
  );
}

/** Taguchi com catálogo carregado: arranjo L8(2^7) escolhido para 4 fatores, S/N "Maior é melhor". */
export function TaguchiComCatalogo() {
  return (
    <div className="flex max-w-2xl flex-col gap-3 bg-surface-0 p-6">
      <p className="text-sm text-muted">
        Robustez do Módulo de Resiliência (MPa) frente a 4 fatores de 2 níveis —
        arranjo ortogonal L8.
      </p>
      <DesignPicker
        config={{
          ...BASE,
          designType: "taguchi",
          taguchiArray: "L8(2^7)",
          taguchiSN: "larger_is_better",
          taguchiLevels: 2,
        }}
        onConfigChange={() => {}}
        replicates={2}
        onReplicatesChange={() => {}}
        factorCount={4}
        hasQualitativeFactor={false}
        taguchiArrays={CATALOGO_TAGUCHI}
      />
    </div>
  );
}

/** Composição: as três famílias de triagem avançada lado a lado — Plackett-Burman, D-ótimo e DSD. */
export function TriagemPlackettBurmanOtimoDSD() {
  return (
    <div className="grid gap-6 bg-surface-0 p-6 xl:grid-cols-3">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          Plackett-Burman: 6 fatores da mistura em 8 ensaios.
        </p>
        <DesignPicker
          config={{ ...BASE, designType: "plackett_burman" }}
          onConfigChange={() => {}}
          replicates={1}
          onReplicatesChange={() => {}}
          factorCount={6}
          hasQualitativeFactor={false}
        />
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          D-ótimo: orçamento fixo de 12 ensaios com fator qualitativo (Tipo de
          Fibra).
        </p>
        <DesignPicker
          config={{
            ...BASE,
            designType: "optimal",
            optimalCriterion: "D",
            optimalNRuns: 12,
            optimalModel: "linear_interactions",
          }}
          onConfigChange={() => {}}
          replicates={1}
          onReplicatesChange={() => {}}
          factorCount={3}
          hasQualitativeFactor={true}
        />
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          DSD: curvatura de 4 fatores quantitativos com 1 corrida extra → 11
          ensaios.
        </p>
        <DesignPicker
          config={{
            ...BASE,
            designType: "dsd",
            dsdExtraRuns: 1,
          }}
          onConfigChange={() => {}}
          replicates={1}
          onReplicatesChange={() => {}}
          factorCount={4}
          hasQualitativeFactor={false}
        />
      </div>
    </div>
  );
}

"use client";

import type {
  CCDVariant,
  DesignType,
  OptimalCriterion,
  RSMModel,
  SNObjective,
  TaguchiArray,
} from "@/domain/design";
import { useTaguchiCatalog } from "@/hooks/useTaguchiCatalog";

export type FractionalMode = "resolution" | "generators";

/** Sentinela do seletor de arranjo Taguchi: deixa o backend escolher. */
export const TAGUCHI_AUTO = "" as const;

/**
 * Nota didática de 1 frase por família, exibida sob o seletor (e reutilizada
 * no card de recomendação do tour guiado). Linguagem de professor para leigo.
 */
export const DESIGN_FAMILY_NOTE: Record<DesignType, string> = {
  full_factorial_2k:
    "Testa todas as combinações de níveis; ideal até 4 fatores, pois os ensaios dobram a cada fator novo.",
  fractional_factorial_2kp:
    "Triagem com metade (ou menos) dos ensaios do fatorial completo; em troca, algumas interações podem se confundir entre si.",
  central_composite:
    "Adiciona pontos axiais e centrais para ajustar a curvatura e localizar o ponto ótimo (superfície de resposta).",
  box_behnken:
    "Ajusta modelo quadrático sem levar todos os fatores aos extremos ao mesmo tempo; útil quando os cantos do domínio são arriscados ou caros.",
  taguchi:
    "Arranjos ortogonais voltados à robustez: estimam efeitos principais com poucos ensaios.",
  plackett_burman:
    "Triagem de muitos fatores em pouquíssimos ensaios; estima só os efeitos principais.",
  optimal:
    "Desenho construído sob medida quando há restrições ou orçamento fixo de ensaios.",
  dsd: "Triagem definitiva: efeitos principais limpos de confusão com interações de 2 fatores.",
  full_factorial_general:
    "Testa todas as combinações dos níveis declarados em cada fator; com três níveis já estima curvatura, mas o número de ensaios cresce depressa.",
};

/** UI state of the design picker (mapped to the request payload on generate). */
export interface DesignConfig {
  designType: DesignType;
  fractionalMode: FractionalMode;
  fractionalResolution: number;
  fractionalGenerators: string;
  ccdVariant: CCDVariant;
  ccdCenterFactorial: number;
  ccdCenterAxial: number;
  bbdCenter: number;
  centerPoints: number;
  // Taguchi
  taguchiArray: string; // "" → automático
  taguchiSN: SNObjective;
  taguchiLevels: number; // níveis por fator (2, 3, 4…) quando o arranjo comporta
  // D/I-ótimo
  optimalCriterion: OptimalCriterion;
  optimalNRuns: number;
  optimalModel: RSMModel;
  // DSD
  dsdExtraRuns: number;
}

export function defaultDesignConfig(): DesignConfig {
  return {
    designType: "full_factorial_2k",
    fractionalMode: "resolution",
    fractionalResolution: 3,
    fractionalGenerators: "",
    ccdVariant: "rotatable",
    ccdCenterFactorial: 4,
    ccdCenterAxial: 4,
    bbdCenter: 3,
    centerPoints: 0,
    taguchiArray: TAGUCHI_AUTO,
    taguchiSN: "larger_is_better",
    taguchiLevels: 2,
    optimalCriterion: "D",
    optimalNRuns: 0,
    optimalModel: "linear_interactions",
    dsdExtraRuns: 0,
  };
}

// ---------------------------------------------------------------------------
// Contagem de parâmetros do modelo RSM (para o default/guard de n_runs no ótimo).
// Espelha `_model_matrix` do backend: intercepto + main effects + interações 2f
// + quadráticos (só fatores quantitativos). Aqui aproximamos todos os fatores
// como quantitativos (limite superior seguro para o guard).
// ---------------------------------------------------------------------------

export function optimalParamCount(k: number, model: RSMModel): number {
  if (k < 1) return 1;
  let params = 1 + k; // intercepto + efeitos principais
  const interactions = (k * (k - 1)) / 2;
  if (model === "linear_interactions" || model === "full") {
    params += interactions;
  }
  if (model === "linear_quadratic" || model === "full") {
    params += k; // quadráticos (assumindo quantitativos)
  }
  return params;
}

/** Próximo múltiplo de 4 estritamente maior que `k` (construção de Hadamard). */
export function plackettBurmanRuns(k: number): number {
  if (k < 1) return 0;
  return Math.floor(k / 4) * 4 + 4;
}

/** Ensaios de um DSD: 2·(fatores) + 1 (+ 2 por corrida extra). */
export function dsdRuns(k: number, extraRuns: number): number {
  if (k < 1) return 0;
  return 2 * k + 1 + 2 * extraRuns;
}

// ---------------------------------------------------------------------------
// Run-count previews (contagem combinatória para UX; o design em si — matriz,
// α exato, aliasing — é SEMPRE gerado pelo backend).
// ---------------------------------------------------------------------------

function comb(n: number, r: number): number {
  if (r < 0 || r > n) return 0;
  let result = 1;
  for (let i = 0; i < r; i += 1) {
    result = (result * (n - i)) / (i + 1);
  }
  return Math.round(result);
}

/**
 * Espelha `pyDOE3.fracfact_by_res`: menor nº de fatores-base que comporta
 * `k` fatores na resolução pedida. `null` = fração inexistente (o backend
 * devolveria 422).
 */
export function fractionalBaseFactors(
  k: number,
  resolution: number,
): number | null {
  for (let base = resolution - 1; base < k; base += 1) {
    let capacity = base;
    for (let r = resolution - 1; r <= base; r += 1) {
      capacity += comb(base, r);
    }
    if (capacity >= k) return base;
  }
  return null;
}

/**
 * Nº de fatores-base declarados numa string de geradores pyDOE3 ("a b ab"),
 * ou `null` quando a string não define um design válido para `k` fatores.
 */
export function generatorsBaseFactors(
  generators: string,
  k: number,
): number | null {
  const words = generators.trim().split(/\s+/).filter(Boolean);
  if (words.length !== k) return null;
  if (!words.every((word) => /^-?[a-zA-Z]+$/.test(word))) return null;

  const letters = words.map((word) => word.replace("-", "").toLowerCase());
  const baseLetters = letters.filter((word) => word.length === 1);
  const baseSet = new Set(baseLetters);
  if (baseSet.size === 0 || baseSet.size !== baseLetters.length) return null;
  const allComposedOfBase = letters.every((word) =>
    [...word].every((ch) => baseSet.has(ch)),
  );
  return allComposedOfBase ? baseSet.size : null;
}

/**
 * Menor arranjo Taguchi (do catálogo) que comporta `k` fatores no nº de
 * `levels` níveis pedido; `null` quando nenhum arranjo do catálogo cabe (ou o
 * catálogo ainda não carregou). Espelha `_auto_select_oa` do backend para o par
 * (níveis→demanda) uniforme usado na UI.
 */
export function resolveTaguchiArray(
  arrays: readonly TaguchiArray[] | undefined,
  k: number,
  levels: number,
): TaguchiArray | null {
  if (!arrays || k < 1) return null;
  const fitting = arrays.filter(
    (a) => (a.level_capacity[levels] ?? 0) >= k,
  );
  if (fitting.length === 0) return null;
  // catálogo já vem ordenado por runs; garante menor por segurança
  return fitting.reduce((best, a) => (a.runs < best.runs ? a : best));
}

/** Ensaios de UMA réplica (inclui pontos centrais); `null` = indeterminado. */
export function designBaseRuns(
  config: DesignConfig,
  factorCount: number,
  taguchiArrays?: readonly TaguchiArray[],
): number | null {
  const k = factorCount;
  if (k < 1) return null;
  switch (config.designType) {
    case "full_factorial_2k":
      return 2 ** k + config.centerPoints;
    case "full_factorial_general":
      // O total é o produto dos níveis declarados em cada fator, e esta
      // assinatura só recebe a contagem de fatores, não a lista de níveis.
      // Indeterminado aqui; quem tem os fatores em mãos calcula o produto.
      return null;
    case "fractional_factorial_2kp": {
      const base =
        config.fractionalMode === "resolution"
          ? fractionalBaseFactors(k, config.fractionalResolution)
          : generatorsBaseFactors(config.fractionalGenerators, k);
      return base === null ? null : 2 ** base + config.centerPoints;
    }
    case "central_composite":
      return 2 ** k + 2 * k + config.ccdCenterFactorial + config.ccdCenterAxial;
    case "box_behnken":
      return k >= 3 ? 2 * k * (k - 1) + config.bbdCenter : null;
    case "taguchi": {
      const array =
        config.taguchiArray === TAGUCHI_AUTO
          ? resolveTaguchiArray(taguchiArrays, k, config.taguchiLevels)
          : (taguchiArrays?.find((a) => a.name === config.taguchiArray) ??
            null);
      return array === null ? null : array.runs;
    }
    case "plackett_burman":
      return k >= 2 ? plackettBurmanRuns(k) : null;
    case "optimal":
      return config.optimalNRuns >= 1 ? config.optimalNRuns : null;
    case "dsd":
      return k >= 2 ? dsdRuns(k, config.dsdExtraRuns) : null;
  }
}

function toRoman(resolution: number): string {
  switch (resolution) {
    case 3:
      return "III";
    case 4:
      return "IV";
    case 5:
      return "V";
    case 6:
      return "VI";
    default:
      return String(resolution);
  }
}

function clampInt(raw: string, min: number, max: number): number {
  const value = Math.trunc(Number(raw));
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

const CCD_VARIANTS: ReadonlyArray<{
  value: CCDVariant;
  label: string;
  description: string;
}> = [
  {
    value: "rotatable",
    label: "Rotável",
    description:
      "α = (2^k)^(1/4): variância de predição uniforme sobre a esfera.",
  },
  {
    value: "orthogonal",
    label: "Ortogonal",
    description: "α escolhido para ortogonalidade dos termos quadráticos.",
  },
  {
    value: "face_centered",
    label: "Face-centrada",
    description:
      "α = 1: pontos axiais nas faces do cubo; não extrapola a faixa dos fatores.",
  },
];

const SN_OBJECTIVES: ReadonlyArray<{ value: SNObjective; label: string }> = [
  { value: "larger_is_better", label: "Maior é melhor" },
  { value: "smaller_is_better", label: "Menor é melhor" },
  { value: "nominal_is_best", label: "Nominal é melhor" },
];

const TAGUCHI_LEVEL_OPTIONS: ReadonlyArray<number> = [2, 3, 4, 5];

const OPTIMAL_CRITERIA: ReadonlyArray<{
  value: OptimalCriterion;
  label: string;
  description: string;
}> = [
  {
    value: "D",
    label: "D-ótimo",
    description: "Maximiza det(X'X): coeficientes precisos (triagem).",
  },
  {
    value: "I",
    label: "I-ótimo",
    description: "Minimiza a variância média de predição; ideal para RSM.",
  },
];

const OPTIMAL_MODELS: ReadonlyArray<{ value: RSMModel; label: string }> = [
  { value: "linear", label: "Linear (efeitos principais)" },
  { value: "linear_interactions", label: "Linear + interações 2f" },
  { value: "linear_quadratic", label: "Linear + quadráticos" },
  { value: "full", label: "Completo (interações + quadráticos)" },
];

interface DesignPickerProps {
  config: DesignConfig;
  onConfigChange: (config: DesignConfig) => void;
  replicates: number;
  onReplicatesChange: (replicates: number) => void;
  factorCount: number;
  hasQualitativeFactor: boolean;
}

const inputClass =
  "rounded-md border border-border-strong bg-surface-0 px-3 py-2 text-foreground-strong outline-none transition focus:border-primary focus:ring-1 focus:ring-primary";

const panelClass =
  "flex flex-col gap-3 rounded-lg border border-border bg-surface-0/50 p-4";

export function DesignPicker({
  config,
  onConfigChange,
  replicates,
  onReplicatesChange,
  factorCount,
  hasQualitativeFactor,
}: DesignPickerProps) {
  const k = factorCount;
  const set = (patch: Partial<DesignConfig>) =>
    onConfigChange({ ...config, ...patch });

  const catalogQuery = useTaguchiCatalog();
  const taguchiArrays = catalogQuery.data?.arrays;

  const baseRuns = designBaseRuns(config, k, taguchiArrays);
  const totalRuns = baseRuns === null ? null : baseRuns * replicates;
  const requiresQuantitative =
    config.designType === "central_composite" ||
    config.designType === "box_behnken";
  const qualitativeBlocked = requiresQuantitative && hasQualitativeFactor;
  const showCenterPoints =
    config.designType === "full_factorial_2k" ||
    config.designType === "fractional_factorial_2kp";
  const resolutionUnavailable =
    config.designType === "fractional_factorial_2kp" &&
    config.fractionalMode === "resolution" &&
    fractionalBaseFactors(k, config.fractionalResolution) === null;

  const alphaPreview =
    config.ccdVariant === "rotatable"
      ? (2 ** k) ** 0.25
      : config.ccdVariant === "face_centered"
        ? 1
        : null;

  // --- Taguchi derived state ---
  const taguchiSelected =
    config.designType === "taguchi" && config.taguchiArray !== TAGUCHI_AUTO
      ? (taguchiArrays?.find((a) => a.name === config.taguchiArray) ?? null)
      : null;
  const taguchiResolved =
    config.designType === "taguchi"
      ? config.taguchiArray === TAGUCHI_AUTO
        ? resolveTaguchiArray(taguchiArrays, k, config.taguchiLevels)
        : taguchiSelected
      : null;
  // O arranjo escolhido comporta os k fatores no nº de níveis pedido?
  const taguchiFits =
    config.designType !== "taguchi" ||
    taguchiResolved === null ||
    (taguchiResolved.level_capacity[config.taguchiLevels] ?? 0) >= k;
  const taguchiNoAutoFit =
    config.designType === "taguchi" &&
    config.taguchiArray === TAGUCHI_AUTO &&
    taguchiArrays !== undefined &&
    taguchiResolved === null;

  // --- Optimal derived state ---
  const optimalParams = optimalParamCount(k, config.optimalModel);
  const optimalTooFew =
    config.designType === "optimal" && config.optimalNRuns < optimalParams;

  return (
    <div className="rounded-xl border border-border bg-surface-1 p-6 shadow-lg">
      <h2 className="mb-4 text-lg font-medium text-foreground">Planejamento</h2>

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-foreground-soft">Família de planejamento</span>
          <select
            value={config.designType}
            onChange={(e) => set({ designType: e.target.value as DesignType })}
            className={inputClass}
          >
            <option value="full_factorial_2k">Fatorial completo 2^k</option>
            <option value="fractional_factorial_2kp">
              Fatorial fracionado 2^(k-p)
            </option>
            <option value="central_composite">Composto central (CCD)</option>
            <option value="box_behnken">Box-Behnken</option>
            <option value="taguchi">Taguchi (arranjo ortogonal)</option>
            <option value="plackett_burman">Plackett-Burman</option>
            <option value="optimal">D/I-ótimo</option>
            <option value="dsd">Definitive Screening (DSD)</option>
          </select>
          <span className="text-xs text-faint">
            {DESIGN_FAMILY_NOTE[config.designType]}
          </span>
        </label>

        {config.designType === "fractional_factorial_2kp" ? (
          <fieldset className={panelClass}>
            <legend className="px-1 text-sm font-medium text-foreground-soft">
              Fração 2^(k-p)
            </legend>
            <div className="flex gap-6 text-sm">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="fractional-mode"
                  checked={config.fractionalMode === "resolution"}
                  onChange={() => set({ fractionalMode: "resolution" })}
                  className="accent-accent-mid"
                />
                <span className="text-foreground">Por resolução</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="fractional-mode"
                  checked={config.fractionalMode === "generators"}
                  onChange={() => set({ fractionalMode: "generators" })}
                  className="accent-accent-mid"
                />
                <span className="text-foreground">Por geradores</span>
              </label>
            </div>

            {config.fractionalMode === "resolution" ? (
              <label className="flex w-40 flex-col gap-1 text-sm">
                <span className="text-foreground-soft">Resolução</span>
                <select
                  value={config.fractionalResolution}
                  onChange={(e) =>
                    set({ fractionalResolution: Number(e.target.value) })
                  }
                  className={inputClass}
                >
                  <option value={3}>III</option>
                  <option value={4}>IV</option>
                  <option value={5}>V</option>
                </select>
                <span className="text-xs text-faint">
                  III: triagem · IV: efeitos principais limpos · V: interações
                  de 2 fatores limpas
                </span>
              </label>
            ) : (
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-foreground-soft">Geradores (sintaxe pyDOE3)</span>
                <input
                  type="text"
                  value={config.fractionalGenerators}
                  onChange={(e) =>
                    set({ fractionalGenerators: e.target.value })
                  }
                  placeholder="a b ab"
                  className={`${inputClass} font-mono`}
                />
                <span className="text-xs text-faint">
                  Uma palavra por fator: letras sozinhas são os fatores-base;
                  palavras compostas (ex.: ab) definem os fatores fracionados.
                </span>
              </label>
            )}

            {resolutionUnavailable ? (
              <p className="text-xs text-warning">
                Não existe fração 2^(k-p) de resolução{" "}
                {toRoman(config.fractionalResolution)} para {k} fator(es);
                reduza a resolução ou use o fatorial completo.
              </p>
            ) : null}
          </fieldset>
        ) : null}

        {config.designType === "central_composite" ? (
          <fieldset className={panelClass}>
            <legend className="px-1 text-sm font-medium text-foreground-soft">
              Composto central
            </legend>
            <div className="flex flex-col gap-2 text-sm">
              {CCD_VARIANTS.map((variant) => (
                <label
                  key={variant.value}
                  className="flex cursor-pointer items-start gap-2"
                >
                  <input
                    type="radio"
                    name="ccd-variant"
                    checked={config.ccdVariant === variant.value}
                    onChange={() => set({ ccdVariant: variant.value })}
                    className="mt-1 accent-accent-mid"
                  />
                  <span>
                    <span className="text-foreground">{variant.label}</span>
                    <span className="block text-xs text-faint">
                      {variant.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex w-40 flex-col gap-1 text-sm">
                <span className="text-foreground-soft">Centros (fatorial)</span>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={config.ccdCenterFactorial}
                  onChange={(e) =>
                    set({ ccdCenterFactorial: clampInt(e.target.value, 0, 20) })
                  }
                  className={inputClass}
                />
              </label>
              <label className="flex w-40 flex-col gap-1 text-sm">
                <span className="text-foreground-soft">Centros (axial)</span>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={config.ccdCenterAxial}
                  onChange={(e) =>
                    set({ ccdCenterAxial: clampInt(e.target.value, 0, 20) })
                  }
                  className={inputClass}
                />
              </label>
            </div>
            <p className="text-xs text-muted">
              {alphaPreview !== null ? (
                <>
                  α previsto:{" "}
                  <span className="font-mono text-accent-mid">
                    {alphaPreview.toFixed(3)}
                  </span>
                </>
              ) : (
                "α calculado pelo backend para garantir a ortogonalidade."
              )}
            </p>
          </fieldset>
        ) : null}

        {config.designType === "box_behnken" ? (
          <fieldset className={panelClass}>
            <legend className="px-1 text-sm font-medium text-foreground-soft">
              Box-Behnken
            </legend>
            {k < 3 ? (
              <p className="text-sm text-danger">
                Box-Behnken exige pelo menos 3 fatores (há {k}).
              </p>
            ) : null}
            <label className="flex w-40 flex-col gap-1 text-sm">
              <span className="text-foreground-soft">Pontos centrais</span>
              <input
                type="number"
                min={0}
                max={20}
                value={config.bbdCenter}
                onChange={(e) =>
                  set({ bbdCenter: clampInt(e.target.value, 0, 20) })
                }
                className={inputClass}
              />
            </label>
          </fieldset>
        ) : null}

        {config.designType === "taguchi" ? (
          <fieldset className={panelClass}>
            <legend className="px-1 text-sm font-medium text-foreground-soft">
              Taguchi (arranjo ortogonal)
            </legend>
            <p className="text-xs text-faint">
              Arranjos ortogonais estimam efeitos principais com poucos ensaios;
              o objetivo S/N define como o backend classifica a robustez.
            </p>
            <div className="flex flex-wrap gap-4">
              <label className="flex w-56 flex-col gap-1 text-sm">
                <span className="text-foreground-soft">Arranjo</span>
                <select
                  value={config.taguchiArray}
                  onChange={(e) => set({ taguchiArray: e.target.value })}
                  className={inputClass}
                  disabled={catalogQuery.isLoading}
                >
                  <option value={TAGUCHI_AUTO}>Automático (backend escolhe)</option>
                  {(taguchiArrays ?? []).map((array) => (
                    <option key={array.name} value={array.name}>
                      {array.name} · {array.runs} ensaios
                    </option>
                  ))}
                </select>
                {catalogQuery.isLoading ? (
                  <span className="text-xs text-faint">
                    Carregando catálogo…
                  </span>
                ) : catalogQuery.isError ? (
                  <span className="text-xs text-warning">
                    Catálogo indisponível; use &quot;Automático&quot;.
                  </span>
                ) : null}
              </label>

              <label className="flex w-40 flex-col gap-1 text-sm">
                <span className="text-foreground-soft">Níveis por fator</span>
                <select
                  value={config.taguchiLevels}
                  onChange={(e) =>
                    set({ taguchiLevels: Number(e.target.value) })
                  }
                  className={inputClass}
                >
                  {TAGUCHI_LEVEL_OPTIONS.map((lv) => (
                    <option key={lv} value={lv}>
                      {lv} níveis
                    </option>
                  ))}
                </select>
                <span className="text-xs text-faint">
                  Fatores com 3+ níveis exigem colunas do arranjo que os
                  comportem.
                </span>
              </label>

              <label className="flex w-56 flex-col gap-1 text-sm">
                <span className="text-foreground-soft">Objetivo S/N</span>
                <select
                  value={config.taguchiSN}
                  onChange={(e) =>
                    set({ taguchiSN: e.target.value as SNObjective })
                  }
                  className={inputClass}
                >
                  {SN_OBJECTIVES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {taguchiResolved !== null ? (
              <p className="text-xs text-muted">
                Arranjo:{" "}
                <span className="font-mono text-accent-mid">
                  {taguchiResolved.name}
                </span>
                , com {taguchiResolved.runs} ensaios e{" "}
                {taguchiResolved.n_columns} coluna(s).
              </p>
            ) : null}

            {config.taguchiArray !== TAGUCHI_AUTO && !taguchiFits ? (
              <p className="text-xs text-warning">
                O arranjo {config.taguchiArray} não tem {k} coluna(s) de{" "}
                {config.taguchiLevels} níveis; escolha um arranjo maior ou use
                &quot;Automático&quot;.
              </p>
            ) : null}

            {taguchiNoAutoFit ? (
              <p className="text-xs text-warning">
                Nenhum arranjo do catálogo comporta {k} fator(es) de{" "}
                {config.taguchiLevels} níveis; reduza os fatores ou os níveis.
              </p>
            ) : null}
          </fieldset>
        ) : null}

        {config.designType === "plackett_burman" ? (
          <fieldset className={panelClass}>
            <legend className="px-1 text-sm font-medium text-foreground-soft">
              Plackett-Burman
            </legend>
            <p className="text-xs text-faint">
              Triagem de muitos fatores em poucos ensaios (2 níveis). O nº de
              ensaios é o próximo múltiplo de 4 ≥ k+1.
            </p>
            {k < 2 ? (
              <p className="text-sm text-danger">
                Plackett-Burman exige pelo menos 2 fatores (há {k}).
              </p>
            ) : (
              <p className="text-xs text-muted">
                {k} fator(es) →{" "}
                <span className="font-mono text-accent-mid">
                  {plackettBurmanRuns(k)}
                </span>{" "}
                ensaios.
              </p>
            )}
          </fieldset>
        ) : null}

        {config.designType === "optimal" ? (
          <fieldset className={panelClass}>
            <legend className="px-1 text-sm font-medium text-foreground-soft">
              D/I-ótimo
            </legend>
            <p className="text-xs text-faint">
              Aceita fator qualitativo; ideal para restrições ou orçamento fixo
              de ensaios.
            </p>
            <div className="flex flex-col gap-2 text-sm">
              {OPTIMAL_CRITERIA.map((c) => (
                <label
                  key={c.value}
                  className="flex cursor-pointer items-start gap-2"
                >
                  <input
                    type="radio"
                    name="optimal-criterion"
                    checked={config.optimalCriterion === c.value}
                    onChange={() => set({ optimalCriterion: c.value })}
                    className="mt-1 accent-accent-mid"
                  />
                  <span>
                    <span className="text-foreground">{c.label}</span>
                    <span className="block text-xs text-faint">
                      {c.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex w-64 flex-col gap-1 text-sm">
                <span className="text-foreground-soft">Modelo alvo</span>
                <select
                  value={config.optimalModel}
                  onChange={(e) =>
                    set({ optimalModel: e.target.value as RSMModel })
                  }
                  className={inputClass}
                >
                  {OPTIMAL_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-faint">
                  Parâmetros do modelo: {optimalParams}.
                </span>
              </label>
              <label className="flex w-40 flex-col gap-1 text-sm">
                <span className="text-foreground-soft">Nº de ensaios</span>
                <input
                  type="number"
                  min={optimalParams}
                  max={200}
                  value={config.optimalNRuns || ""}
                  placeholder={String(optimalParams)}
                  onChange={(e) =>
                    set({ optimalNRuns: clampInt(e.target.value, 0, 200) })
                  }
                  className={inputClass}
                />
                <span className="text-xs text-faint">
                  Recomendado ≥ {optimalParams} (nº de parâmetros).
                </span>
              </label>
            </div>
            {optimalTooFew ? (
              <p className="text-xs text-warning">
                {config.optimalNRuns} ensaio(s) é menos que os {optimalParams}{" "}
                parâmetros do modelo; o design ficaria singular. Aumente para ≥{" "}
                {optimalParams}.
              </p>
            ) : null}
            {k < 2 ? (
              <p className="text-sm text-danger">
                O planejamento ótimo exige pelo menos 2 fatores (há {k}).
              </p>
            ) : null}
          </fieldset>
        ) : null}

        {config.designType === "dsd" ? (
          <fieldset className={panelClass}>
            <legend className="px-1 text-sm font-medium text-foreground-soft">
              Definitive Screening (DSD)
            </legend>
            <p className="text-xs text-faint">
              Estima curvatura com poucos ensaios; fatores quantitativos (+
              categóricos de 2 níveis).
            </p>
            {k < 2 ? (
              <p className="text-sm text-danger">
                O DSD exige pelo menos 2 fatores (há {k}).
              </p>
            ) : (
              <p className="text-xs text-muted">
                {k} fator(es) → 2·{k} + 1 ={" "}
                <span className="font-mono text-accent-mid">
                  {dsdRuns(k, config.dsdExtraRuns)}
                </span>{" "}
                ensaios{config.dsdExtraRuns > 0 ? " (com extras)" : ""}.
              </p>
            )}
            <label className="flex w-56 flex-col gap-1 text-sm">
              <span className="text-foreground-soft">Corridas extras (fake factors)</span>
              <input
                type="number"
                min={0}
                max={12}
                value={config.dsdExtraRuns}
                onChange={(e) =>
                  set({ dsdExtraRuns: clampInt(e.target.value, 0, 12) })
                }
                className={inputClass}
              />
              <span className="text-xs text-faint">
                Cada corrida extra adiciona 2 ensaios (melhora a estimativa do
                erro).
              </span>
            </label>
          </fieldset>
        ) : null}

        {showCenterPoints ? (
          <label className="flex w-56 flex-col gap-1 text-sm">
            <span className="text-foreground-soft">Pontos centrais</span>
            <input
              type="number"
              min={0}
              max={20}
              value={config.centerPoints}
              onChange={(e) =>
                set({ centerPoints: clampInt(e.target.value, 0, 20) })
              }
              className={inputClass}
            />
            <span className="text-xs text-faint">
              Recomendado 3–5 para estimar curvatura e erro puro.
            </span>
          </label>
        ) : null}

        <label className="flex w-40 flex-col gap-1 text-sm">
          <span className="text-foreground-soft">Réplicas</span>
          <input
            type="number"
            min={1}
            max={20}
            value={replicates}
            onChange={(e) =>
              onReplicatesChange(Math.max(1, Number(e.target.value) || 1))
            }
            className={inputClass}
          />
        </label>

        {qualitativeBlocked ? (
          <p className="rounded-md border border-warning-strong/40 bg-warning-strong/10 px-3 py-2 text-sm text-warning">
            CCD/Box-Behnken exigem fatores quantitativos; remova ou converta
            os fatores qualitativos antes de gerar.
          </p>
        ) : null}

        <div className="rounded-lg border border-accent-strong/30 bg-accent-strong/5 p-4">
          <p className="text-sm text-foreground-soft">
            <RunFormula config={config} k={k} baseRuns={baseRuns} />
            {baseRuns !== null ? <> × {replicates} réplica(s)</> : null}
          </p>
          <p className="mt-1 text-sm text-foreground">
            Número de ensaios:{" "}
            <span className="font-mono text-lg font-semibold text-accent-mid">
              {totalRuns ?? "…"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

function RunFormula({
  config,
  k,
  baseRuns,
}: {
  config: DesignConfig;
  k: number;
  baseRuns: number | null;
}) {
  switch (config.designType) {
    case "full_factorial_2k":
      return (
        <>
          {k} fatores × 2 níveis = 2<sup>{k}</sup> ={" "}
          <span className="font-mono text-accent-mid">
            {k >= 1 ? 2 ** k : 0}
          </span>{" "}
          combinações + {config.centerPoints} ponto(s) central(is)
        </>
      );
    case "fractional_factorial_2kp": {
      if (baseRuns === null) {
        return config.fractionalMode === "generators" ? (
          <>Nº de ensaios definido pelos geradores (uma palavra por fator)</>
        ) : (
          <>Fração indisponível para essa resolução</>
        );
      }
      const corners = baseRuns - config.centerPoints;
      const p = k - Math.round(Math.log2(corners));
      return (
        <>
          2<sup>{k}−{p}</sup> ={" "}
          <span className="font-mono text-accent-mid">{corners}</span> corridas +{" "}
          {config.centerPoints} ponto(s) central(is)
        </>
      );
    }
    case "central_composite":
      return (
        <>
          2<sup>{k}</sup> ({2 ** k} cubo) + 2·{k} ({2 * k} axiais) +{" "}
          {config.ccdCenterFactorial + config.ccdCenterAxial} centros
        </>
      );
    case "box_behnken":
      return k >= 3 ? (
        <>
          4·{k}·({k}−1)/2 ={" "}
          <span className="font-mono text-accent-mid">{2 * k * (k - 1)}</span>{" "}
          corridas + {config.bbdCenter} ponto(s) central(is)
        </>
      ) : (
        <>Box-Behnken requer pelo menos 3 fatores</>
      );
    case "taguchi":
      return baseRuns === null ? (
        <>Arranjo Taguchi a definir para {k} fator(es)</>
      ) : (
        <>
          Arranjo ortogonal ={" "}
          <span className="font-mono text-accent-mid">{baseRuns}</span> ensaios
        </>
      );
    case "plackett_burman":
      return k >= 2 ? (
        <>
          próximo múltiplo de 4 ≥ {k}+1 ={" "}
          <span className="font-mono text-accent-mid">
            {plackettBurmanRuns(k)}
          </span>{" "}
          ensaios
        </>
      ) : (
        <>Plackett-Burman requer pelo menos 2 fatores</>
      );
    case "optimal":
      return baseRuns === null ? (
        <>Defina o nº de ensaios do design ótimo</>
      ) : (
        <>
          {config.optimalCriterion}-ótimo ={" "}
          <span className="font-mono text-accent-mid">{baseRuns}</span> ensaios
        </>
      );
    case "dsd":
      return k >= 2 ? (
        <>
          2·{k} + 1 ={" "}
          <span className="font-mono text-accent-mid">
            {dsdRuns(k, config.dsdExtraRuns)}
          </span>{" "}
          ensaios
        </>
      ) : (
        <>DSD requer pelo menos 2 fatores</>
      );
  }
}

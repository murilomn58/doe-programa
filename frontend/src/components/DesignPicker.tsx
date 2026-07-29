"use client";

import {
  nNiveis,
  type CCDVariant,
  type DesignType,
  type FactorInput,
  type OptimalCriterion,
  type RSMModel,
  type SNObjective,
} from "@/domain/design";
import { TAGUCHI_AUTO, type DesignConfig } from "@/domain/designConfig";
import {
  contarEnsaios,
  dsdRuns,
  fractionalBaseFactors,
  plackettBurmanRuns,
  resolveTaguchiArray,
} from "@/domain/runCount";
import { useTaguchiCatalog } from "@/hooks/useTaguchiCatalog";

// Re-exports: `DesignConfig`/`defaultDesignConfig` (estado do formulário) e a
// contagem de ensaios (`designBaseRuns` + auxiliares) agora moram no domínio
// — ver domain/designConfig.ts e domain/runCount.ts — porque designPayload.ts
// e o motor de recomendação (recommend.ts) precisam delas sem depender de um
// componente React. Mantidos aqui só para não quebrar quem já importava
// destes símbolos a partir de "@/components/DesignPicker".
export type { DesignConfig, FractionalMode } from "@/domain/designConfig";
export { defaultDesignConfig, TAGUCHI_AUTO } from "@/domain/designConfig";
export {
  designBaseRuns,
  dsdRuns,
  fractionalBaseFactors,
  generatorsBaseFactors,
  plackettBurmanRuns,
  resolveTaguchiArray,
} from "@/domain/runCount";

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
  /** Fatores declarados (com os níveis); a contagem e os avisos vêm daqui. */
  factors: FactorInput[];
}

// ---------------------------------------------------------------------------
// Avisos contextuais calculados a partir dos fatores declarados. Puros — sem
// UI — para poderem ser testados isoladamente se um dia saírem daqui.
// ---------------------------------------------------------------------------

/** Ponto axial (valor natural) de um fator, dado o α do CCD. */
function pontoAxialNatural(
  low: number,
  high: number,
  alpha: number,
  ladoAlto: boolean,
): number {
  const centro = (low + high) / 2;
  const meiaAmplitude = (high - low) / 2;
  return ladoAlto ? centro + alpha * meiaAmplitude : centro - alpha * meiaAmplitude;
}

/**
 * α exato do CCD para as duas variantes que podem extrapolar a faixa
 * declarada (rotável e ortogonal). Espelha `pyDOE3.doe_star.star()`:
 * rotável = (2^k)^(1/4); ortogonal = sqrt(k·(1+nao/na) / (1+nco/nc)), com
 * nc = 2^k (pontos do cubo), na = 2·k (pontos axiais), nco/nao os pontos
 * centrais de cada bloco. Face centrada usa α = 1 e nunca extrapola, por
 * isso não entra aqui (o chamador já filtra essa variante fora).
 */
function alphaCcd(
  variant: CCDVariant,
  k: number,
  centerFactorial: number,
  centerAxial: number,
): number | null {
  if (k < 1) return null;
  if (variant === "rotatable") return (2 ** k) ** 0.25;
  if (variant === "orthogonal") {
    const nc = 2 ** k;
    const na = 2 * k;
    return Math.sqrt((k * (1 + centerAxial / na)) / (1 + centerFactorial / nc));
  }
  return null;
}

/** Número em pt-BR (vírgula decimal), até 2 casas, sem zeros à toa. */
function formatarNatural(valor: number): string {
  return (Math.round(valor * 100) / 100).toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  });
}

/**
 * Aviso 1: pontos axiais do CCD rotável/ortogonal que ultrapassam o mínimo ou
 * o máximo declarado de algum fator. A recomendação (domain/recommend.ts)
 * só propõe face centrada exatamente para nunca cair aqui — a faixa
 * declarada costuma ser limite físico do laboratório (ex.: fibra vegetal
 * trazida por avião, material contado). Rotável/ortogonal seguem no
 * catálogo, mas avisados.
 */
function avisoAxialForaDaFaixa(
  config: DesignConfig,
  factors: FactorInput[],
): string | null {
  if (config.designType !== "central_composite") return null;
  if (config.ccdVariant === "face_centered") return null;
  const alpha = alphaCcd(
    config.ccdVariant,
    factors.length,
    config.ccdCenterFactorial,
    config.ccdCenterAxial,
  );
  if (alpha === null) return null;

  const linhas: string[] = [];
  for (const f of factors) {
    if (f.factor_type !== "quantitative") continue;
    if (f.low === undefined || f.high === undefined) continue;
    const unidade = f.unit ? ` ${f.unit}` : "";
    const nome = f.name || "fator";
    const alto = pontoAxialNatural(f.low, f.high, alpha, true);
    const baixo = pontoAxialNatural(f.low, f.high, alpha, false);
    if (alto > f.high) {
      linhas.push(
        `${nome}: o ponto axial pede ${formatarNatural(alto)}${unidade}, acima do máximo declarado de ${formatarNatural(f.high)}${unidade}`,
      );
    }
    if (baixo < f.low) {
      linhas.push(
        `${nome}: o ponto axial pede ${formatarNatural(baixo)}${unidade}, abaixo do mínimo declarado de ${formatarNatural(f.low)}${unidade}`,
      );
    }
  }
  return linhas.length > 0 ? linhas.join("; ") : null;
}

/** Famílias que só ensaiam os dois extremos (−1/+1) de cada fator. */
const FAMILIAS_SO_EXTREMOS = new Set<DesignType>([
  "full_factorial_2k",
  "fractional_factorial_2kp",
  "plackett_burman",
  "dsd",
]);

/**
 * Aviso 2a: a família selecionada só ensaia os extremos, mas algum fator
 * declarou 3+ níveis — os intermediários declarados não entram na matriz.
 */
function avisoNiveisSoExtremos(
  config: DesignConfig,
  factors: FactorInput[],
): string | null {
  if (!FAMILIAS_SO_EXTREMOS.has(config.designType)) return null;
  const algumTemNiveisExtras = factors.some((f) => nNiveis(f) >= 3);
  if (!algumTemNiveisExtras) return null;
  return "Este arranjo ensaia apenas o mínimo e o máximo; os níveis intermediários declarados não são usados.";
}

const TOLERANCIA_CENTRO = 1e-9;

/**
 * Aviso 2b: CCD e Box-Behnken sempre usam o ponto médio da faixa como
 * centro. Se o aluno editou o nível central à mão (o NiveisFator permite
 * isso) para um valor diferente da média de low/high, o arranjo ignora essa
 * edição e ensaia o ponto médio mesmo assim.
 */
function avisoCentroEditado(
  config: DesignConfig,
  factors: FactorInput[],
): string | null {
  if (config.designType !== "central_composite" && config.designType !== "box_behnken") {
    return null;
  }
  const linhas: string[] = [];
  for (const f of factors) {
    if (f.factor_type !== "quantitative" || !f.levels) continue;
    const n = f.levels.length;
    // Só há um "centro" único e nomeável quando a contagem é ímpar (o caso
    // mais comum, 3 níveis, tem exatamente um ponto médio).
    if (n < 3 || n % 2 === 0) continue;
    if (f.low === undefined || f.high === undefined) continue;
    const media = (f.low + f.high) / 2;
    const centroDeclarado = f.levels[Math.floor(n / 2)];
    if (Math.abs(centroDeclarado - media) > TOLERANCIA_CENTRO) {
      const unidade = f.unit ? ` ${f.unit}` : "";
      const nome = f.name || "fator";
      linhas.push(
        `${nome}: o arranjo ensaia o ponto médio (${formatarNatural(media)}${unidade}), não o valor editado (${formatarNatural(centroDeclarado)}${unidade})`,
      );
    }
  }
  return linhas.length > 0 ? linhas.join("; ") : null;
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
  factors,
}: DesignPickerProps) {
  const k = factors.length;
  const hasQualitativeFactor = factors.some((f) => f.factor_type === "qualitative");
  const set = (patch: Partial<DesignConfig>) =>
    onConfigChange({ ...config, ...patch });

  const catalogQuery = useTaguchiCatalog();
  const taguchiArrays = catalogQuery.data?.arrays;

  // `baseRuns` é o tamanho de UM bloco, UMA réplica (a combinatória pura da
  // família, que as legendas de `RunFormula` explicam); força `blocks: 1`
  // aqui para não confundir essa legenda com a expansão de blocos. O total
  // exibido ao usuário vem direto de `contarEnsaios` com blocks e réplicas
  // reais, a mesma fonte única que a vitrine de planos usa.
  const baseRuns = contarEnsaios({ ...config, blocks: 1 }, factors, 1, taguchiArrays);
  const totalRuns = contarEnsaios(config, factors, replicates, taguchiArrays);
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
    config.ccdVariant === "face_centered"
      ? 1
      : alphaCcd(config.ccdVariant, k, config.ccdCenterFactorial, config.ccdCenterAxial);

  const avisoAxial = avisoAxialForaDaFaixa(config, factors);
  const avisoNiveis = avisoNiveisSoExtremos(config, factors);
  const avisoCentro = avisoCentroEditado(config, factors);

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
            <option value="full_factorial_general">
              Fatorial completo (níveis múltiplos)
            </option>
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

        {avisoNiveis ? (
          <p className="text-xs text-warning">{avisoNiveis}</p>
        ) : null}

        {config.designType === "full_factorial_general" ? (
          <fieldset className={panelClass}>
            <legend className="px-1 text-sm font-medium text-foreground-soft">
              Fatorial completo (níveis múltiplos)
            </legend>
            <p className="text-xs text-faint">
              Testa todas as combinações dos níveis declarados em cada fator;
              os níveis vêm do formulário de fatores, não há controle
              adicional aqui.
            </p>
          </fieldset>
        ) : null}

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
            {avisoAxial ? (
              <p className="text-xs text-warning">{avisoAxial}</p>
            ) : null}
            {avisoCentro ? (
              <p className="text-xs text-warning">{avisoCentro}</p>
            ) : null}
          </fieldset>
        ) : null}

        {config.designType === "box_behnken" ? (
          <fieldset className={panelClass}>
            <legend className="px-1 text-sm font-medium text-foreground-soft">
              Box-Behnken
            </legend>
            {avisoCentro ? (
              <p className="text-xs text-warning">{avisoCentro}</p>
            ) : null}
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

        <div className="flex flex-wrap gap-4">
          <label className="flex w-40 flex-col gap-1 text-sm">
            <span className="text-foreground-soft">Blocos</span>
            <input
              type="number"
              min={1}
              max={20}
              value={config.blocks}
              onChange={(e) => set({ blocks: clampInt(e.target.value, 1, 20) })}
              className={inputClass}
            />
          </label>

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
        </div>
        <p className="text-xs text-faint">
          Bloco é uma fonte de variação conhecida que não é objeto do estudo,
          como lote de material, dia de moldagem ou tipo de solo.
        </p>

        {qualitativeBlocked ? (
          <p className="rounded-md border border-warning-strong/40 bg-warning-strong/10 px-3 py-2 text-sm text-warning">
            CCD/Box-Behnken exigem fatores quantitativos; remova ou converta
            os fatores qualitativos antes de gerar.
          </p>
        ) : null}

        <div className="rounded-lg border border-accent-strong/30 bg-accent-strong/5 p-4">
          <p className="text-sm text-foreground-soft">
            <RunFormula config={config} k={k} baseRuns={baseRuns} />
            {baseRuns !== null ? (
              <>
                {" "}
                × {config.blocks} bloco(s) × {replicates} réplica(s)
              </>
            ) : null}
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
    case "full_factorial_general":
      return k >= 1 ? (
        <>
          Produto dos níveis declarados em cada fator ={" "}
          <span className="font-mono text-accent-mid">{baseRuns ?? "…"}</span>{" "}
          combinações
        </>
      ) : (
        <>Declare ao menos 1 fator para calcular as combinações</>
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

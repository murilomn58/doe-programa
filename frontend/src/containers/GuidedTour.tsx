"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AliasingReport } from "@/components/AliasingReport";
import {
  defaultDesignConfig,
  optimalParamCount,
  type DesignConfig,
} from "@/components/DesignPicker";
import { FactorForm } from "@/components/FactorForm";

import { PedirEmailModal } from "@/components/PedirEmailModal";
import { ResponsesForm } from "@/components/ResponsesForm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { StepNav } from "@/components/ui/StepNav";
import { VitrineDePlanos } from "@/components/VitrineDePlanos";
import { DataEntry } from "@/containers/DataEntry";
import {
  apenasFatores,
  blocoDeclarado,
  nBlocos,
  type FactorInput,
  type ResponseInput,
} from "@/domain/design";
import { buildDesignRequest, factorIsValid } from "@/domain/designPayload";
import { motivoDeMinimo } from "@/domain/limitesFamilia";
import {
  GOAL_OPTIONS,
  recommendPlans,
  type PlanoSugerido,
  type ResearchGoal,
  type RotuloPlano,
} from "@/domain/recommend";
import { contarEnsaios } from "@/domain/runCount";
import { useGenerateDesign } from "@/hooks/useDesign";
import { useTaguchiCatalog } from "@/hooks/useTaguchiCatalog";
import { devePedirEmail } from "@/lib/conta";

/**
 * Explica por que a família de UM plano não pode gerar com os fatores atuais
 * — a MESMA regra que já bloqueava o botão "Gerar matriz" (ver `familyBlocked`
 * abaixo), reaproveitada para marcar um cartão da vitrine como indisponível,
 * com o motivo, em vez de deixar o usuário escolher um plano que travaria lá
 * na frente sem explicação.
 */
export function motivoBloqueio(
  config: DesignConfig,
  factors: FactorInput[],
  hasQualitativeFactor: boolean,
): string | undefined {
  const k = factors.length;
  const requiresQuantitative =
    config.designType === "central_composite" ||
    config.designType === "box_behnken";
  if (requiresQuantitative && hasQualitativeFactor) {
    return "Este arranjo não aceita fator qualitativo; remova ou converta o fator antes de escolher este plano.";
  }
  // Mínimo de fatores por família: fonte única em domain/limitesFamilia.ts,
  // espelhada em backend/tests/test_minimos_por_familia.py. Cobre as 9
  // famílias (antes só 4 tinham guarda aqui, e era assim que CCD/fatorial
  // geral/2^k/fracionado/Taguchi escapavam sem checagem de mínimo).
  const motivoMinimo = motivoDeMinimo(config.designType, k);
  if (motivoMinimo) return motivoMinimo;
  // Guardas que não são de contagem: seguem vivendo aqui.
  if (
    config.designType === "fractional_factorial_2kp" &&
    config.fractionalMode === "generators" &&
    config.fractionalGenerators.trim().length === 0
  ) {
    return "Defina os geradores da fração antes de escolher este plano.";
  }
  if (config.designType === "optimal") {
    const optimalParams = optimalParamCount(k, config.optimalModel);
    if (config.optimalNRuns < optimalParams) {
      return "Ajuste o nº de ensaios do planejamento ótimo antes de escolher este plano.";
    }
  }
  return undefined;
}

/**
 * Uma entrada está pronta para gerar quando é um fator válido de verdade OU,
 * se declarada como bloco, tem ao menos 2 categorias nomeadas e sem branco.
 * O motor recusa um bloco malformado de qualquer jeito, mas o usuário não
 * deve descobrir isso só ao clicar em "Gerar matriz".
 */
function entradaIsValid(f: FactorInput): boolean {
  if (!f.name.trim()) return false;
  if (f.papel === "bloco") {
    const nomes = f.categorias ?? [];
    return nomes.length >= 2 && nomes.every((c) => c.trim().length > 0);
  }
  return factorIsValid(f);
}

/**
 * Texto do Callout do passo 3, honesto com o nº de planos que
 * `recommendPlans` de fato devolveu — nunca fixo em "três", porque a
 * triagem de dois níveis (e a superfície com fator qualitativo) devolvem
 * só um.
 */
function textoPasso3(nPlanos: number): string {
  if (nPlanos <= 1) {
    return "Preparamos abaixo o plano de planejamento recomendado, calculado a partir do seu objetivo e dos níveis declarados em cada fator.";
  }
  if (nPlanos === 2) {
    return "Comparamos abaixo dois planos de planejamento, calculados a partir do seu objetivo e dos níveis declarados em cada fator: o recomendado e o mais econômico.";
  }
  return "Comparamos abaixo três planos de planejamento, calculados a partir do seu objetivo e dos níveis declarados em cada fator: o recomendado, o mais econômico e o mais completo.";
}

const emptyQuantFactor = (): FactorInput => ({
  name: "",
  factor_type: "quantitative",
});
const emptyResponse = (): ResponseInput => ({ name: "" });

/** Passos guiados (a bifurcação inicial é uma tela de entrada, fora do StepNav). */
type TourStep = "branch" | "goal" | "factors" | "design" | "data";
const GUIDED_STEPS = ["Objetivo", "Fatores e respostas", "Planejamento", "Dados"];
const STEP_INDEX: Record<Exclude<TourStep, "branch">, number> = {
  goal: 0,
  factors: 1,
  design: 2,
  data: 3,
};

export function GuidedTour() {
  const router = useRouter();
  const [step, setStep] = useState<TourStep>("branch");
  const [name, setName] = useState("");
  const [goal, setGoal] = useState<ResearchGoal | null>(null);
  const [factors, setFactors] = useState<FactorInput[]>([
    emptyQuantFactor(),
    emptyQuantFactor(),
  ]);
  const [responses, setResponses] = useState<ResponseInput[]>([emptyResponse()]);
  const [replicates, setReplicates] = useState(1);
  const [designConfig, setDesignConfig] =
    useState<DesignConfig>(defaultDesignConfig);
  const [catalogoAberto, setCatalogoAberto] = useState(false);
  const [rotuloSelecionado, setRotuloSelecionado] =
    useState<RotuloPlano>("recomendado");
  const [pedirEmail, setPedirEmail] = useState(false);

  const generateDesign = useGenerateDesign();
  const taguchiCatalog = useTaguchiCatalog();

  // Uma entrada com `papel === "bloco"` NÃO é um fator: sai da lista que vai
  // ao motor de recomendação e à contagem de ensaios, e vira blocagem
  // separada. Sem esta separação, o tipo de solo (uma entrada só, marcada
  // como bloco) seria contado como fator qualitativo e derrubaria CCD/BBD à
  // toa, além de inflar a combinatória do fatorial geral.
  const fatoresParaContagem = useMemo(() => apenasFatores(factors), [factors]);
  const blocoAtivo = useMemo(() => blocoDeclarado(factors), [factors]);
  const numBlocosDeclarados = useMemo(() => nBlocos(factors), [factors]);

  const hasQualitativeFactor = fatoresParaContagem.some(
    (f) => f.factor_type === "qualitative",
  );
  const factorsReady = factors.length >= 2 && factors.every(entradaIsValid);
  const blocoInvalido = blocoAtivo !== undefined && !entradaIsValid(blocoAtivo);

  // Vitrine de planos (passo 3): recomendado, mais econômico e mais completo,
  // já com os níveis declarados por fator (recommendPlans "enxerga" curvatura
  // declarada em 3+ níveis, não só a contagem de fatores). Usa só as entradas
  // que são fator de verdade — o bloco não entra nesta conta.
  const planos = useMemo<PlanoSugerido[]>(
    () =>
      goal
        ? recommendPlans({
            goal,
            factors: fatoresParaContagem,
            blocks: numBlocosDeclarados,
          })
        : [],
    [goal, fatoresParaContagem, numBlocosDeclarados],
  );
  // Decora cada plano com `indisponivel` quando a família dele, para os
  // fatores atuais, cairia numa das guardas que bloqueiam "Gerar matriz" —
  // ver ponto (e) do enunciado: a guarda passa a explicar o motivo no
  // cartão, em vez de só travar o botão lá na frente sem dizer por quê.
  const planosDecorados = useMemo<PlanoSugerido[]>(
    () =>
      planos.map((p) => {
        if (p.indisponivel) return p;
        const config: DesignConfig = { ...defaultDesignConfig(), ...p.configPatch };
        const motivo = motivoBloqueio(config, fatoresParaContagem, hasQualitativeFactor);
        return motivo ? { ...p, indisponivel: motivo } : p;
      }),
    [planos, fatoresParaContagem, hasQualitativeFactor],
  );
  const planoSelecionado =
    planosDecorados.find((p) => p.rotulo === rotuloSelecionado) ??
    planosDecorados[0] ??
    null;

  // O bloco declarado no passo de fatores tem precedência sobre o campo
  // numérico do catálogo avançado (mesma regra de `buildDesignRequest`), para
  // a contagem ao vivo não divergir do que será de fato enviado ao motor.
  const configParaContagem = useMemo<DesignConfig>(
    () =>
      blocoAtivo ? { ...designConfig, blocks: numBlocosDeclarados } : designConfig,
    [designConfig, blocoAtivo, numBlocosDeclarados],
  );
  const runCount = useMemo(
    () =>
      contarEnsaios(
        configParaContagem,
        fatoresParaContagem,
        replicates,
        taguchiCatalog.data?.arrays,
      ),
    [configParaContagem, fatoresParaContagem, replicates, taguchiCatalog.data],
  );
  // Ensaios de UMA repetição do arranjo (sem multiplicar pelos blocos), para
  // a nota didática do card do bloco mostrar "9 x 6 = 54" em vez de só "54".
  const runCountPorBloco = useMemo(
    () =>
      contarEnsaios(
        { ...configParaContagem, blocks: 1 },
        fatoresParaContagem,
        replicates,
        taguchiCatalog.data?.arrays,
      ),
    [configParaContagem, fatoresParaContagem, replicates, taguchiCatalog.data],
  );
  const contagemBlocos = blocoAtivo
    ? { nBlocos: numBlocosDeclarados, porBloco: runCountPorBloco, total: runCount }
    : undefined;

  const familyBlocked =
    motivoBloqueio(designConfig, fatoresParaContagem, hasQualitativeFactor) !==
    undefined;
  const canGenerate = factorsReady && replicates >= 1 && !familyBlocked;

  const generatedId = generateDesign.data?.experiment_id ?? null;

  // Ao gerar a matriz com sucesso, avança para a entrada de dados. Se o
  // usuário entrou sem conta, este é o momento do re-prompt de email (1x).
  useEffect(() => {
    if (generatedId !== null) {
      setStep("data");
      if (devePedirEmail()) setPedirEmail(true);
    }
  }, [generatedId]);

  function updateFactor(index: number, factor: FactorInput) {
    setFactors((prev) => prev.map((f, i) => (i === index ? factor : f)));
  }
  function updateResponse(index: number, response: ResponseInput) {
    setResponses((prev) => prev.map((r, i) => (i === index ? response : r)));
  }

  /**
   * Sai de "fatores" para "planejamento" já aplicando o plano escolhido (ou o
   * recomendado, na primeira visita). NÃO reseta `catalogoAberto`: uma vez
   * que o aluno abriu o catálogo avançado, ele continua aberto ao voltar e
   * reentrar neste passo — essa era a queixa original ("parece estar muito
   * escondido"), e reintroduzir aqui um `setCatalogoAberto(false)` voltaria a
   * escondê-lo a cada visita.
   */
  function goToDesign() {
    const preferido =
      planosDecorados.find((p) => p.rotulo === rotuloSelecionado) ??
      planosDecorados[0];
    if (preferido) {
      setDesignConfig({ ...defaultDesignConfig(), ...preferido.configPatch });
      setReplicates(preferido.replicates ?? 1);
    }
    setStep("design");
  }

  /**
   * Escolhe um cartão da vitrine: aplica DUAS coisas, não uma — o
   * `configPatch` sobre `designConfig` E, quando `plano.replicates` estiver
   * presente, esse valor sobre o estado `replicates` (que vive fora do
   * `DesignConfig`, como estado irmão aqui). Aplicar só o patch faria o plano
   * "mais completo" gerar sem as réplicas que o cartão anuncia.
   */
  function escolherPlano(plano: PlanoSugerido) {
    setRotuloSelecionado(plano.rotulo);
    setDesignConfig({ ...defaultDesignConfig(), ...plano.configPatch });
    setReplicates(plano.replicates ?? 1);
  }

  function handleGenerate() {
    generateDesign.mutate(
      buildDesignRequest({ name, designConfig, replicates, factors, responses }),
    );
  }

  // ---- Tela de entrada: bifurcação planejar × já tenho resultados ----------
  if (step === "branch") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <PageHeader
          title="Criar experimento"
          subtitle="Vamos montar seu experimento passo a passo. Primeiro, a pergunta que muda tudo:"
          back={{ label: "Voltar aos experimentos", href: "/experiments" }}
        />
        <Callout label="Por onde começar">
          Escolha abaixo de acordo com o momento da sua pesquisa. Não precisa
          saber nomes técnicos de planejamento: o programa recomenda o mais
          adequado ao seu objetivo.
        </Callout>
        <h2 className="mb-4 mt-8 text-lg font-medium text-foreground">
          Você já tem os resultados dos ensaios?
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <BranchCard
            badge="Planejar"
            tone="accent"
            title="Não, quero planejar"
            body="O programa monta a matriz de ensaios para você coletar os dados em ordem."
            onClick={() => setStep("goal")}
          />
          <BranchCard
            badge="Analisar"
            tone="info"
            title="Sim, já tenho os dados"
            body="Cole a tabela de resultados e o programa descobre o planejamento por trás e analisa."
            onClick={() => router.push("/retrospective")}
          />
        </div>
      </main>
    );
  }

  const stepIndex = STEP_INDEX[step];

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <PageHeader
        title="Novo planejamento experimental"
        subtitle="Siga os passos: defina o objetivo, os fatores e as respostas; o programa recomenda o planejamento, gera a matriz e leva você até os gráficos."
        back={{ label: "Voltar ao início", onClick: () => setStep("branch") }}
      />
      <StepNav
        steps={GUIDED_STEPS}
        active={stepIndex}
        maxReached={generatedId !== null ? 3 : stepIndex}
        onStep={(i) => {
          if (i === 0) setStep("goal");
          else if (i === 1) setStep("factors");
          else if (i === 2 && goal) setStep("design");
          else if (i === 3 && generatedId !== null) setStep("data");
        }}
      />

      {step === "goal" ? (
        <div className="flex flex-col gap-6">
          <Callout label="Passo 1">
            Dê um nome ao experimento e diga o que você quer descobrir. Na{" "}
            <b>triagem</b>, você ainda tem vários fatores candidatos e quer
            separar, com poucos ensaios, os que realmente afetam o resultado;
            na <b>otimização</b>, os fatores importantes já são conhecidos e a
            meta é achar a combinação de valores que entrega a melhor resposta.
            Essa escolha muda o planejamento: triagem pede economia de ensaios,
            otimização pede pontos extras para mapear a curvatura. Sua resposta
            guia a recomendação do passo 3.
          </Callout>
          <Card>
            <Field label="Nome do experimento" htmlFor="exp-name">
              <Input
                id="exp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Solo-fibra-cimento"
              />
            </Field>
          </Card>
          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium text-foreground-soft">
              Qual é o seu objetivo?
            </span>
            <div className="grid gap-4 sm:grid-cols-2">
              {GOAL_OPTIONS.map((opt) => (
                <GoalCard
                  key={opt.value}
                  selected={goal === opt.value}
                  label={opt.label}
                  description={opt.description}
                  onClick={() => setGoal(opt.value)}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              variant="accent"
              disabled={!goal}
              onClick={() => setStep("factors")}
            >
              Continuar →
            </Button>
          </div>
        </div>
      ) : null}

      {step === "factors" ? (
        <div className="flex flex-col gap-6">
          <Callout label="Passo 2">
            Vocabulário rápido: <b>fator</b> é o que você controla (ex.:
            temperatura), <b>nível</b> é o valor que o fator assume em cada
            ensaio, <b>resposta</b> é o que você mede e <b>réplica</b> é a
            repetição do mesmo ensaio para estimar o erro experimental. Uma
            fonte de variação conhecida que não interessa ao estudo entra
            como bloco, não como fator. Para cada fator numérico, informe o
            menor e o maior valor a testar: eles viram os níveis −1 e +1.
            Prefira faixas realistas do seu processo (nem estreitas demais,
            nem além do que o equipamento alcança) e informe a unidade, pois
            é ela que dá sentido físico aos coeficientes do modelo.
          </Callout>
          <FactorForm
            factors={factors}
            onChange={updateFactor}
            onAdd={() => setFactors((prev) => [...prev, emptyQuantFactor()])}
            onRemove={(index) =>
              setFactors((prev) => prev.filter((_, i) => i !== index))
            }
            contagemBlocos={contagemBlocos}
          />
          <ResponsesForm
            responses={responses}
            onChange={updateResponse}
            onAdd={() => setResponses((prev) => [...prev, emptyResponse()])}
            onRemove={(index) =>
              setResponses((prev) => prev.filter((_, i) => i !== index))
            }
          />
          <div className="flex items-center justify-between">
            {factors.length < 2 ? (
              <p className="text-sm text-warning">
                Adicione ao menos 2 fatores.
              </p>
            ) : blocoInvalido ? (
              <p className="text-sm text-warning">
                O bloco precisa de ao menos 2 categorias nomeadas, sem campos
                em branco.
              </p>
            ) : (
              <Button variant="ghost" onClick={() => setStep("goal")}>
                ← Voltar
              </Button>
            )}
            <Button variant="accent" disabled={!factorsReady} onClick={goToDesign}>
              Continuar → Planejamento
            </Button>
          </div>
        </div>
      ) : null}

      {step === "design" ? (
        <div className="flex flex-col gap-6">
          <Callout label="Passo 3">
            {textoPasso3(planosDecorados.length)} A matriz sai com a ordem dos
            ensaios sorteada (randomizada), o que protege as conclusões contra
            tendências do equipamento e do ambiente ao longo do tempo.{" "}
            {planosDecorados.length <= 1
              ? "Confira o cartão abaixo"
              : "Escolha um cartão"}
            , ou abra o catálogo avançado com as outras famílias de
            planejamento; o número de ensaios aparece ao vivo.
          </Callout>

          <VitrineDePlanos
            planos={planosDecorados}
            selecionado={planoSelecionado}
            onEscolher={escolherPlano}
            catalogoAberto={catalogoAberto}
            onCatalogoAbertoChange={setCatalogoAberto}
            designConfig={designConfig}
            onDesignConfigChange={setDesignConfig}
            replicates={replicates}
            onReplicatesChange={setReplicates}
            factors={factors}
          />

          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep("factors")}>
              ← Voltar
            </Button>
            <Button
              variant="accent"
              disabled={!canGenerate || generateDesign.isPending}
              onClick={handleGenerate}
            >
              {generateDesign.isPending
                ? "Gerando…"
                : runCount !== null
                  ? `Gerar matriz (${runCount} ensaios)`
                  : "Gerar matriz"}
            </Button>
          </div>

          {generateDesign.isError ? (
            <p className="text-sm text-danger">{generateDesign.error.message}</p>
          ) : null}
        </div>
      ) : null}

      {step === "data" && generatedId !== null ? (
        <div className="flex flex-col gap-6">
          <Callout label="Passo 4">
            A matriz foi gerada. Execute os ensaios na <b>ordem sorteada</b> da
            coluna Ensaio (ela existe justamente para proteger contra
            tendências ao longo do tempo) e preencha as colunas de resposta, as
            últimas à direita. Dá para colar um bloco inteiro copiado do Excel;
            quando terminar, siga para os resultados e gráficos.
          </Callout>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-significant">
              Matriz gerada: experimento #{generatedId}.
            </span>
            <div className="flex items-center gap-2">
              {generateDesign.data?.array_name ? (
                <Badge tone="accent" pill>
                  {generateDesign.data.array_name}
                </Badge>
              ) : null}
              {generateDesign.data?.optimal_efficiency != null ? (
                <Badge tone="accent" pill>
                  D-eficiência{" "}
                  {(generateDesign.data.optimal_efficiency * 100).toFixed(1)}%
                </Badge>
              ) : null}
            </div>
          </div>
          {generateDesign.data?.aliasing &&
          generateDesign.data.aliasing.length > 0 ? (
            <AliasingReport
              resolution={generateDesign.data.resolution ?? null}
              aliasing={generateDesign.data.aliasing}
            />
          ) : null}
          <DataEntry experimentId={generatedId} />
          <div className="flex justify-end">
            <Button
              variant="accent"
              size="lg"
              onClick={() => router.push(`/experiments/${generatedId}/analysis`)}
            >
              Concluir → ver resultados e gráficos
            </Button>
          </div>
        </div>
      ) : null}

      <PedirEmailModal
        aberto={pedirEmail}
        contexto="salvar"
        onFechar={() => setPedirEmail(false)}
      />
    </main>
  );
}

/** Cartão da bifurcação inicial (planejar × analisar). */
function BranchCard({
  badge,
  tone,
  title,
  body,
  onClick,
}: {
  badge: string;
  tone: "accent" | "info";
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-2 rounded-xl border border-border bg-surface-1 p-6 text-left shadow-lg transition hover:border-accent-strong"
    >
      <Badge tone={tone}>{badge}</Badge>
      <span className="text-lg font-medium text-foreground-strong">{title}</span>
      <span className="text-sm text-foreground-soft">{body}</span>
    </button>
  );
}

/** Cartão selecionável do objetivo (radio visual). */
function GoalCard({
  selected,
  label,
  description,
  onClick,
}: {
  selected: boolean;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex flex-col gap-1 rounded-xl border p-5 text-left transition ${
        selected
          ? "border-accent-strong bg-accent-strong/10 ring-1 ring-accent-strong"
          : "border-border bg-surface-1 hover:border-border-strong"
      }`}
    >
      <span className="text-sm font-semibold text-foreground-strong">
        {label}
      </span>
      <span className="text-xs text-foreground-soft">{description}</span>
    </button>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AliasingReport } from "@/components/AliasingReport";
import {
  DESIGN_FAMILY_NOTE,
  DesignPicker,
  defaultDesignConfig,
  designBaseRuns,
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
import { DataEntry } from "@/containers/DataEntry";
import type { FactorInput, ResponseInput } from "@/domain/design";
import { buildDesignRequest, factorIsValid } from "@/domain/designPayload";
import {
  GOAL_OPTIONS,
  recommendDesign,
  type ResearchGoal,
} from "@/domain/recommend";
import { useGenerateDesign } from "@/hooks/useDesign";
import { useTaguchiCatalog } from "@/hooks/useTaguchiCatalog";
import { devePedirEmail } from "@/lib/conta";

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
  const [advanced, setAdvanced] = useState(false);
  const [pedirEmail, setPedirEmail] = useState(false);

  const generateDesign = useGenerateDesign();
  const taguchiCatalog = useTaguchiCatalog();

  const hasQualitativeFactor = factors.some(
    (f) => f.factor_type === "qualitative",
  );
  const factorsReady = factors.length >= 2 && factors.every(factorIsValid);

  const recommendation = useMemo(
    () =>
      goal
        ? recommendDesign({
            goal,
            nFactors: factors.length,
            hasQualitative: hasQualitativeFactor,
          })
        : null,
    [goal, factors.length, hasQualitativeFactor],
  );

  const runCount = useMemo(() => {
    const base = designBaseRuns(
      designConfig,
      factors.length,
      taguchiCatalog.data?.arrays,
    );
    return base === null ? null : base * replicates;
  }, [designConfig, factors.length, replicates, taguchiCatalog.data]);

  const requiresQuantitative =
    designConfig.designType === "central_composite" ||
    designConfig.designType === "box_behnken";
  const optimalParams = optimalParamCount(
    factors.length,
    designConfig.optimalModel,
  );
  const familyBlocked =
    (requiresQuantitative && hasQualitativeFactor) ||
    (designConfig.designType === "box_behnken" && factors.length < 3) ||
    (designConfig.designType === "fractional_factorial_2kp" &&
      designConfig.fractionalMode === "generators" &&
      designConfig.fractionalGenerators.trim().length === 0) ||
    (designConfig.designType === "plackett_burman" && factors.length < 2) ||
    (designConfig.designType === "dsd" && factors.length < 2) ||
    (designConfig.designType === "optimal" &&
      (factors.length < 2 || designConfig.optimalNRuns < optimalParams));
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

  /** Sai de "fatores" para "planejamento" já aplicando a família recomendada. */
  function goToDesign() {
    if (recommendation) {
      setDesignConfig({ ...defaultDesignConfig(), ...recommendation.configPatch });
      setAdvanced(false);
    }
    setStep("design");
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
            repetição do mesmo ensaio para estimar o erro experimental. Para
            cada fator numérico, informe o menor e o maior valor a testar: eles
            viram os níveis −1 e +1. Prefira faixas realistas do seu processo
            (nem estreitas demais, nem além do que o equipamento alcança) e
            informe a unidade, pois é ela que dá sentido físico aos
            coeficientes do modelo.
          </Callout>
          <FactorForm
            factors={factors}
            onChange={updateFactor}
            onAdd={() => setFactors((prev) => [...prev, emptyQuantFactor()])}
            onRemove={(index) =>
              setFactors((prev) => prev.filter((_, i) => i !== index))
            }
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
            Com base no seu objetivo, recomendamos abaixo uma família de
            planejamento: ela define quais combinações de níveis serão
            ensaiadas e quantos ensaios você fará. A matriz sai com a ordem dos
            ensaios sorteada (randomizada), o que protege as conclusões contra
            tendências do equipamento e do ambiente ao longo do tempo. Aceite e
            gere a matriz, ou abra as opções avançadas para escolher outra
            família; o número de ensaios aparece ao vivo.
          </Callout>

          {recommendation ? (
            <Card
              title="Planejamento recomendado"
              right={
                runCount !== null ? (
                  <Badge tone="accent" pill>
                    {runCount} ensaios
                  </Badge>
                ) : null
              }
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span title={DESIGN_FAMILY_NOTE[recommendation.designType]}>
                    <Badge tone="significant">{recommendation.title}</Badge>
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-foreground-soft">
                  <span className="font-medium text-foreground">
                    Por que essa escolha?{" "}
                  </span>
                  {recommendation.why}
                </p>
                <p className="text-xs text-faint">
                  {DESIGN_FAMILY_NOTE[recommendation.designType]}
                </p>
                {recommendation.caveat ? (
                  <p className="text-xs text-warning">
                    ⚠ {recommendation.caveat}
                  </p>
                ) : null}
                <div className="mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAdvanced((v) => !v)}
                  >
                    {advanced
                      ? "Ocultar opções avançadas"
                      : "Ver outras opções (avançado)"}
                  </Button>
                </div>
              </div>
            </Card>
          ) : null}

          {advanced ? (
            <DesignPicker
              config={designConfig}
              onConfigChange={setDesignConfig}
              replicates={replicates}
              onReplicatesChange={setReplicates}
              factorCount={factors.length}
              hasQualitativeFactor={hasQualitativeFactor}
            />
          ) : null}

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

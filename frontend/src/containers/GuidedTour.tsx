"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AliasingReport } from "@/components/AliasingReport";
import {
  DesignPicker,
  defaultDesignConfig,
  designBaseRuns,
  optimalParamCount,
  type DesignConfig,
} from "@/components/DesignPicker";
import { FactorForm } from "@/components/FactorForm";
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

  // Ao gerar a matriz com sucesso, avança para a entrada de dados.
  useEffect(() => {
    if (generatedId !== null) setStep("data");
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
          back={{ label: "Voltar ao dashboard", href: "/" }}
        />
        <Callout label="Por onde começar">
          Escolha abaixo de acordo com o momento da sua pesquisa. Não precisa
          saber nomes técnicos de planejamento — o programa recomenda o mais
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
            Dê um nome ao experimento e diga o que você quer descobrir. Sua
            resposta guia a recomendação do planejamento no passo 3.
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
            Liste tudo que você <b>controla</b> no experimento (os fatores) e
            tudo que vai <b>medir</b> (as respostas). Para cada fator numérico,
            informe o menor e o maior valor a testar — eles viram os níveis −1 e
            +1.
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
            Com base no seu objetivo, recomendamos o planejamento abaixo. Aceite
            e gere a matriz, ou abra as opções avançadas para escolher outra
            família. O número de ensaios aparece ao vivo.
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
                  <Badge tone="significant">{recommendation.title}</Badge>
                </div>
                <p className="text-sm leading-relaxed text-foreground-soft">
                  {recommendation.why}
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
            A matriz foi gerada. Preencha as colunas de resposta (as últimas, à
            direita) — dá para colar um bloco copiado do Excel. Quando terminar,
            veja os resultados e gráficos.
          </Callout>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-significant">
              Matriz gerada — experimento #{generatedId}.
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

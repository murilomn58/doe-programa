# PRD — Sincronização de Design System com claude.ai/design

**Data:** 2026-07-10 · **Status:** aprovado (brainstorm 2026-07-10) · **Dono:** Murilo

## Contexto
O app DoE está completo e verde no QA (issues 01–11). O Murilo quer redesenhar a UI na claude.ai/design **partindo do visual atual** (paleta, formas, opções) e depois portar o redesenho de volta — sem mudar funcionalidade e sem tocar no backend.

## Objetivo
Dar à claude.ai/design os componentes reais + a identidade visual atual, de forma que o redesenho feito lá seja portável de volta ao app via uma camada de tokens semânticos (o "contrato" do port-back).

## Abordagem (híbrido A+B, aprovada)
- **A)** Pacote `design-system/` separado e decoplado — snapshot dos componentes presentational puros com tokens semânticos, sincronizado via `/design-sync` (shape *package*, upload incremental num projeto novo).
- **B)** Screenshots das telas reais (QA de 2026-07-08/09, em `docs/adp/fase-final-qa/`) como referência de redesenho de telas inteiras.

## Escopo
1. **Camada de tokens semânticos** (Tailwind 4 `@theme`, em `design-system/src/tokens.css`): superfícies (`surface-0..3`), bordas (`border-subtle/border/border-strong`), texto (`foreground-strong/foreground/foreground-soft/muted/faint`), acento (`accent/accent-mid/accent-strong/accent-deep`), semântica estatística (`significant`, `warning`, `danger`), fonte Inter. Codifica o slate/cyan/emerald atual — trocar paleta = editar este arquivo.
2. **16 componentes decoplados** (cópias, sem imports `@/`): AnovaTable, EffectsTable, CoefTable, StatsPanel, PlotCard, RetroDiagnosisCard, EstimabilityWarning, AliasingReport, ModelBuilder, FactorPairSelector, FactorForm, ResponsesForm, NewExperimentForm, RunsGrid, RetroGrid, DesignPicker. Classes de **cor** reescritas para o vocabulário semântico; todo o resto (espaçamento, tipografia, estrutura, textos PT-BR) pixel-idêntico ao app.
3. **Previews autorais** com dados DoE realistas (exemplo da aula / `docs/adp/reference-outputs.md`), gradadas no rubric absoluto (styled/complete/plausible).
4. **Sync incremental** num projeto novo claude.ai/design (aprovação única de upload no início; componentes aparecem conforme verificados).
5. **Handoff:** URL do projeto + pacote de screenshots + instruções do loop redesenho→port.

## Fora de escopo (agora)
- Port-back do redesenho pro app (**fase 2** — só depois que o Murilo aprovar o redesenho na plataforma; aí sim rerodamos QA completo).
- Gráficos Plotly internos (a moldura `PlotCard` entra; o traço do gráfico não — peso de bundle e o agente de design não redesenha o interior do gráfico).
- Containers/telas (`Dashboard`, `Analysis`, `Report`, …) — cobertos pelos screenshots.
- Qualquer mudança no app Next.js ou no backend.

## Decisões
- **D1:** pacote separado com cópias decopladas — o app fica intocado; o DS é rascunho de design, não fonte de verdade (a fonte continua sendo `frontend/src/components`).
- **D2:** tokens em `@theme` (Tailwind 4) → o vocabulário semântico é o contrato do port-back.
- **D3:** fidelidade estrutural — só cores viram tokens; nada mais muda nas cópias.
- **D4:** Plotly fora do bundle.
- **D5:** dados de preview do domínio real (golden test/aula) — nunca foo/test.
- **D6:** upload incremental (projeto novo e vazio → o run é dono do conteúdo).

## Critérios de aceite
- `npm run build` verde no pacote (tsc + tailwind CLI).
- `package-validate.mjs` exit 0; todas as previews gradadas **good** (ou floor card deliberado e reportado).
- Projeto claude.ai/design populado com os 16 componentes + tokens + guidelines; `_ds_sync.json` ancorado.
- Murilo consegue abrir o projeto e redesenhar usando os componentes reais.

## Riscos
- Divergência futura entre cópias e app (aceito: DS é snapshot; port-back da fase 2 reconcilia).
- Login claude.ai necessário para o upload (bloqueia só a parte remota).

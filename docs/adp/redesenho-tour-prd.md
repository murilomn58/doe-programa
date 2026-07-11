# PRD — Redesenho + Tour guiado (fase 2)

**Data:** 2026-07-11 · **Status:** aprovado · **Base:** redesenho do claude.ai/design (zip em `design-system/_redesign-import/`)

## Objetivo
Aplicar o redesenho (tokens indigo + kit-base + linguagem educativa) no app Next.js e transformar a criação de experimento num **tour guiado** que um pesquisador leigo consegue completar e sair com os gráficos. **Sem mudar o backend.** Funcionalidade preservada; QA rerodado.

## Decisões (travadas com o Murilo)
- **D1 — Recomendação:** mini-questionário leigo (objetivo: triar × otimizar; nº de fatores; todos numéricos?) → recomenda a família com explicação; aceita ou troca (DesignPicker completo = modo avançado).
- **D2 — Retrospectiva:** primeira bifurcação do tour ("Você já tem os resultados?"). Sim → fluxo retrospectivo; Não → planejamento.
- **D3 — Amplitude:** redesenhar tudo. Tokens do zip (primary = **indigo #6366f1**, resto = cores atuais renomeadas) no app inteiro; visual novo + callouts no tour e profiler; demais telas herdam tokens e ganham o kit.

## Escopo
1. **Fundação de tokens** — `frontend/src/app/tokens.css` (`@theme` com as cores do zip) + globals. Trocar `slate/cyan/emerald/blue` crus por classes semânticas em todo o app (valores idênticos aos atuais, exceto primary azul→indigo → zero regressão visual, exceto a cor de ação).
2. **Kit-base UI** (`frontend/src/components/ui/`): Button, Card, Badge, Callout, PageHeader, StepNav, Field, Input, Select, Textarea — tipados, sobre tokens.
3. **Motor de recomendação** — função pura `recommendDesign(objetivo, nFatores, temQualitativo)` → família + texto explicativo (+ testes).
4. **Tour guiado** (`GuidedTour`): bifurcação → questionário → fatores/respostas → recomendação/gerar → dados → **gráficos**. Dashboard troca os 2 botões + form por 1 CTA "Criar experimento (passo a passo)"; retrospectiva vira ramo do tour.
5. **Profiler** — campo numérico editável (valor natural ↔ codificado) ao lado de cada slider.
6. **Restyle** — dashboard, análise, relatório, retrospectiva, entrada de dados e os 16 componentes com o visual novo.

## Fora de escopo
Backend; cálculos; reestruturar a lógica de análise. Só camada de apresentação + o novo fluxo de tour (que reusa endpoints existentes).

## Critérios de aceite
- `npm run typecheck` + `npm run lint` + `npm run build` verdes.
- Tour completa ponta a ponta: leigo cria experimento sem saber os termos e chega aos gráficos.
- Profiler aceita número digitado e o slider acompanha.
- Sem regressão funcional (golden test/análise intactos); verificação visual (Playwright) desktop+mobile.

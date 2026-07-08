---
slug: doe-app
issue: 05
title: Visualização interativa base (Plotly)
status: done
blocked_by: 04
qa: VERDE (2026-07-08) — pytest 61/61, ruff limpo, typecheck 0 erros, build OK. QA visual Playwright: CA1 console.error=0; CA2 todos 8 gráficos renderizados (Superfície 3D, Contorno, Pareto, Efeitos Principais, Interação, Obs vs Pred, Resíduos, Q-Q); CA3 linha tracejada Pareto p=0.05 com valor t correto; CA4 linha 45° + anotação R²; CA5 seletor de par aparece com ≥3 fatores, oculto com 2 (correto); CA6 Q-Q reta de referência OK. Screenshots em docs/adp/issue05-qa/.
notas: PlotParams importado de react-plotly.js (não de plotly.js-dist-min). contours.z 3D tipado com cast `as unknown as Data` (gap no @types/plotly.js). hint do PlotCard alterado para ReactNode. PlotService já estava completo no backend (61 testes).
---

## Pai
PRD: `docs/adp/doe-app-prd.md`

## O que construir
Os gráficos interativos base na tela de Análise, renderizados com Plotly.js a partir de dados calculados no backend (PlotService). Nesta fatia: superfície de resposta 3D (resposta vs 2 fatores, demais no centro), curva de contorno 2D, Pareto de efeitos padronizados (com linha p=.05), gráfico de efeitos principais, gráfico de interação (marginal means com IC95%), observado-vs-predito (reta 45° + R²), e plots de resíduos base (vs ajustado, Q-Q). Seletor de qual par de fatores plotar. Todo array (grid Z, efeitos, quantis) vem do backend; o frontend só desenha. Plotly importado com `dynamic(..., {ssr:false})`.

## Camadas tocadas
- Backend: `router (/analysis)` estende resposta com dados de gráfico → `PlotService` (gera grids/arrays em JSON Plotly)
- Frontend: `api`/`hook (useAnalysis)` → `container (Analysis)` → `presentational (PlotCard, SurfacePlot, ContourPlot, ParetoPlot, MainEffectsPlot, InteractionPlot, ObsVsPredPlot, ResidualPlots)`

## Novas adoções
**Plotly.js / react-plotly.js**. MIT. `dynamic ssr:false`. Ver `docs/adp/research-findings.md`.

## Critérios de aceitação
- [ ] **CA9**: as telas renderizam sem erro de console; superfície 3D, contorno, Pareto e obs-vs-predito aparecem (verificação Playwright/qa-frontend)
- [ ] Pareto tem linha de significância p=.05
- [ ] Interação mostra IC95%; obs-vs-predito mostra reta 45° e R²
- [ ] Seletor de par de fatores atualiza superfície/contorno
- [ ] Dados dos gráficos vêm do backend (nenhum cálculo estatístico no frontend)

## User stories cobertas
33, 34, 35, 36, 37, 38 (Q-Q e resíduos base; leverage/Cook na 10), 41

## Blocked by
04

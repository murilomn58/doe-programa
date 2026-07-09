---
slug: doe-app
issue: 10
title: Diagnósticos avançados + profiler interativo
status: concluida
blocked_by: 05
---

## Pai
PRD: `docs/adp/doe-app-prd.md`

## O que construir
Completar o conjunto de visualização com os gráficos avançados e a interação: cube plot (3 fatores), half-normal/normal plot dos efeitos, resíduos vs ordem de execução, resíduos vs leverage + distância de Cook (influence plot), profiler interativo (arrastar um fator e ver a resposta recalcular em tempo real, com o ótimo embutido — o grid recalculado é servido pelo backend), e overlay de contorno/desejabilidade multi-resposta (região que atende MR e DP juntos).

## Camadas tocadas
- Backend: `PlotService` estende (cube, half-normal, leverage/Cook, desirability grid) + `router (/analysis ou /profiler)` para recálculo do profiler
- Frontend: `presentational (CubePlot, HalfNormalPlot, InfluencePlot, Profiler, DesirabilityOverlay)`

## Novas adoções
Nenhuma (Plotly + statsmodels já adotados).

## Critérios de aceitação
- [ ] Cube plot (3 fatores), half-normal plot e influence plot (leverage/Cook) renderizam
- [ ] Resíduos vs ordem de execução disponível
- [ ] Profiler: arrastar um fator recalcula a resposta (grid servido pelo backend)
- [ ] Overlay de desejabilidade mostra região viável para MR e DP juntos
- [ ] Sem erro de console (verificação Playwright/qa-frontend)

## User stories cobertas
36, 38 (leverage/Cook), 39, 40

## Blocked by
05

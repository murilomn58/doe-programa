---
slug: doe-app
issue: 08
title: Export de gráficos de publicação (matplotlib/SciencePlots)
status: concluida
blocked_by: 05
---

## Pai
PRD: `docs/adp/doe-app-prd.md`

## O que construir
Exportar qualquer gráfico em qualidade de publicação a partir do backend: o PlotService ganha um modo de render server-side com matplotlib + SciencePlots (estilos science/ieee/nature, colormap viridis). Gráficos 2D (contorno, Pareto, efeitos, interação, obs-vs-predito, resíduos) saem em vetor (SVG/PDF); superfície 3D sai em raster PNG/TIFF 600 DPI. Botão de export por gráfico na tela de Análise → download do arquivo.

## Camadas tocadas
- Backend: `router (/export)` (formato png/svg) → `controller` → `PlotService` (render matplotlib+SciencePlots)
- Frontend: `presentational (PlotCard)` ganha botão de export → `api`/`hook`

## Novas adoções
**matplotlib + SciencePlots** (export publicação). MIT. Ver `docs/adp/research-findings.md`.

## Critérios de aceitação
- [ ] **CA8 (parcial)**: export de gráfico em PNG e SVG
- [ ] 2D sai vetor (SVG/PDF); superfície 3D sai raster 600 DPI
- [ ] Estilo científico aplicado (SciencePlots), colormap viridis consistente com o browser
- [ ] O gráfico exportado corresponde ao que está na tela (mesmos dados do backend)

## User stories cobertas
42

## Blocked by
05

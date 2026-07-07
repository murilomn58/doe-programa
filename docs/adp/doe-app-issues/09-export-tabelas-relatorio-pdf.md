---
slug: doe-app
issue: 09
title: Export de tabelas + Relatório PDF (Playwright)
status: aprovada
blocked_by: 04, 05
---

## Pai
PRD: `docs/adp/doe-app-prd.md`

## O que construir
Fechar o output: exportar a matriz de projeto e as tabelas (ANOVA, coeficientes) em CSV PT-BR (`sep=';'`, `decimal=','`, `utf-8-sig`) e Excel multi-aba (XlsxWriter: abas ANOVA / Coeficientes / Matriz de projeto), e gerar um relatório PDF de um clique. O PDF é produzido pelo Playwright (Chromium headless) renderizando uma rota `/report` do próprio Next.js — que monta fatores, matriz, tabelas, gráficos (Plotly ao vivo) e interpretação — em PDF pixel-perfect.

## Camadas tocadas
- Backend: `router (/export)` (formato csv/xlsx/pdf) → `controller` → `ExportService` (XlsxWriter, CSV, orquestra Playwright)
- Frontend: `container (rota /report)` + botões de export/relatório na tela de Análise

## Novas adoções
**XlsxWriter** (BSD-2, Excel multi-aba) e **Playwright** (Apache-2.0, PDF via Chromium headless — `npx playwright install chromium`). Ver `docs/adp/research-findings.md` e ADR-009.

## Critérios de aceitação
- [ ] **CA8 (completo)**: CSV em formato PT-BR; Excel com abas ANOVA/Coeficientes/Matriz; PDF contém tabelas + gráficos
- [ ] Relatório PDF de um clique inclui fatores, matriz, tabelas e gráficos
- [ ] Rota /report renderiza os gráficos Plotly ao vivo antes do Playwright capturar
- [ ] Funciona offline (Chromium local)

## User stories cobertas
43, 44

## Blocked by
04, 05

---
slug: doe-app
issue: 07
title: Famílias screening/ótimo (Taguchi, Plackett-Burman, D/I-optimal, DSD)
status: concluida
blocked_by: 02
---

## Pai
PRD: `docs/adp/doe-app-prd.md`

## O que construir
Completar o DesignService com as famílias de screening e design ótimo: Taguchi (escolha de arranjo ortogonal do catálogo L4/L8/L9/L12/L16/L18/L27…, atribuição de fatores às colunas, cálculo de razão S/N com objetivo larger/smaller/nominal), Plackett-Burman, designs D/I-optimal (via `doe_optimal` do pyDOE3, com fator qualitativo entrando por model matrix manual — dummy sem quadrático, `n_runs ≥ n_params`, critério I-optimal preferível para RSM), e DSD categórico (lib `definitive-screening-design` vendorada, 2 níveis por categórico). Guards: avisar quando os fatores não couberem no arranjo Taguchi escolhido.

## Camadas tocadas
- Backend: `DesignService` estende geração (pyDOE3 `doe_taguchi`, `pbdesign`, `doe_optimal`; DSD vendorado) + `StatsService` (S/N ratio) + validações
- Frontend: `container (ExperimentSetup)` / `presentational (DesignPicker: seletor de OA Taguchi, config de D-optimal/DSD)`

## Novas adoções
**definitive-screening-design 0.5.0** — VENDORAR `design.py` em `backend/vendor/dsd/` (BSD-3, numpy+pandas; bus-factor). Taguchi e D-optimal usam o pyDOE3 já adotado. Ver `docs/adp/design-libs-decision.md`.

## Critérios de aceitação
- [ ] **CA3**: golden-matrix tests — catálogo Taguchi bate; PB, D/I-optimal e DSD geram matriz esperada
- [ ] Taguchi calcula S/N ratio (larger/smaller/nominal) por ensaio
- [ ] **CA (story 46)**: aviso se os fatores não couberem no arranjo Taguchi
- [ ] D/I-optimal aceita fator qualitativo (model matrix sem dummy²; `n_runs ≥ n_params`)
- [ ] DSD categórico (2 níveis) gera design com de-aliasing correto (correlação ~0 main-vs-2ª-ordem)
- [ ] Lib DSD vendorada (sem dependência frágil em runtime)

## User stories cobertas
11 (Taguchi/PB/D-optimal/DSD), 16, 17, 18, 46

## Blocked by
02

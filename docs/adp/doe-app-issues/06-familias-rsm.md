---
slug: doe-app
issue: 06
title: Famílias de design RSM (fracionado, center points, CCD, Box-Behnken)
status: concluida
blocked_by: 02
---

## Pai
PRD: `docs/adp/doe-app-prd.md`

## O que construir
Engordar o DesignService (e o DesignPicker) com as famílias de design de superfície de resposta além do 2^k: fatorial fracionado 2^(k-p) (com geradores, resolução III/IV/V e relatório de aliasing/confounding), fatorial + pontos centrais (para curvatura e lack-of-fit), CCD (rotatable/orthogonal/face-centered, com α e pontos axiais/centrais) e Box-Behnken. Configuração de cada família na UI. Guard: bloquear fator qualitativo em CCD/Box-Behnken com explicação (rodar 1 design por categoria ou usar D-optimal/DSD). Golden-matrix tests por família contra pyDOE3.

## Camadas tocadas
- Backend: `DesignService` estende geração (pyDOE3 `fracfact`/`fracfact_by_res`/`fracfact_aliasing`, center points, `ccdesign`, `bbdesign`) + validações
- Frontend: `container (ExperimentSetup)` / `presentational (DesignPicker, aliasing report, config de CCD/BBD)`

## Novas adoções
Nenhuma (usa pyDOE3 já adotado na 02).

## Critérios de aceitação
- [ ] **CA3**: cada família gera a matriz esperada (nº de ensaios, codificação, aliasing) — golden-matrix tests
- [ ] Fracionado mostra estrutura de aliasing e resolução
- [ ] CCD configurável (rotatable/orthogonal/face-centered, α, center points)
- [ ] Box-Behnken exige k≥3 com mensagem clara se não (CA — story 45)
- [ ] **CA (story 49)**: fator qualitativo em CCD/BBD é bloqueado com explicação
- [ ] Pontos centrais habilitam detecção de curvatura + Pure Error/Lack-of-Fit na análise

## User stories cobertas
11 (fracionado/CCD/BBD/center points), 12, 15, 45 (Box-Behnken), 49

## Blocked by
02

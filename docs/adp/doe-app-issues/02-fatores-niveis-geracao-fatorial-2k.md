---
slug: doe-app
issue: 02
title: Fatores/níveis + geração fatorial 2^k
status: done
blocked_by: 01
qa: VERDE (2026-07-07) — pytest 16/16 (golden-matrix 2³ vs ff2n byte-a-byte, codificação round-trip, mapa qualitativo), build+lint+typecheck verdes, geração 2^k ao vivo + QA visual (Playwright) PASS. Commits 510bcfd, 9d16763, e2bca60, af6aff2.
notas: pyDOE3 1.6.2 instalado no venv. Std Order na ordem pyDOE3 (order-independent p/ ANOVA). Valores de run em JSON (cells). Wizard com useState.
---

## Pai
PRD: `docs/adp/doe-app-prd.md`

## O que construir
Definir fatores e níveis de um experimento e gerar a matriz de um fatorial completo 2^k. No wizard de setup (estilo OriginPro Factorial Design), o usuário adiciona fatores (nome, tipo quantitativo/qualitativo, unidade), define níveis (baixo/alto para quantitativo; rótulos para qualitativo — ex: Tucum/Piassava) e uma ou mais respostas. Ao gerar, o DesignService produz a matriz 2^k via pyDOE3 `ff2n`, com codificação ±1 explícita (mapa persistido para o qualitativo), colunas Run Order (randomizada), Std Order, Point Type, Blocks, Replicates, e a matriz aparece na RunsTable (read-only nesta fatia). Suporte a réplicas.

## Camadas tocadas
- Backend: `router (/designs/generate)` → `controller` → `DesignService` (+ pyDOE3 `ff2n`, codificação) → `ExperimentRepository` (persiste Factor/Level/Run) → models `Factor`, `Level`, `Run`, `Response`, enums `DesignType`/`FactorType`
- Frontend: `api` → `hook (useDesign)` → `container (ExperimentSetup wizard)` → `presentational (FactorForm, DesignPicker, RunsTable read-only)`

## Novas adoções
**pyDOE3 1.6.2** (geração — `ff2n`). BSD-3, numpy+scipy. Verificado empiricamente. Ver `docs/adp/design-libs-decision.md`.

## Critérios de aceitação
- [ ] Adicionar N fatores (quant e qualit) com níveis e respostas pela UI
- [ ] Gerar 2^k produz 2^k ensaios × réplicas com codificação ±1 correta (golden-matrix test vs pyDOE3 `ff2n`) — CA3
- [ ] Fator qualitativo recebe mapa fixo ±1 persistido (ex: Tucum=−1/Piassava=+1) — base do CA7
- [ ] Matriz tem Run Order randomizado + Std Order + Point Type + Blocks + Replicates (estilo OriginPro)
- [ ] RunsTable exibe a matriz gerada
- [ ] Número de ensaios é mostrado antes de gerar

## User stories cobertas
6, 7, 8, 9, 10, 11 (só 2^k nesta fatia), 12 (réplicas), 13, 14

## Blocked by
01

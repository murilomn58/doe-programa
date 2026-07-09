---
slug: doe-app
issue: 11
title: Análise retrospectiva — diagnóstico de dados prontos e sugestão de estudo
status: aprovada
blocked_by: 06
---

## Pai
PRD: `docs/adp/doe-app-prd.md` (escopo novo aprovado pelo Murilo em 2026-07-08, fora do PRD original — esta issue é o registro do escopo)

## O que construir
Nova tela **/retrospective** para quem já tem resultados de ensaios sem ter planejado com o app: uma tabela editável à esquerda (colar do Excel, importar CSV, colunas dinâmicas de fatores/respostas) e um **card de diagnóstico ao vivo à direita** que, a cada edição (debounce), responde:
1. **Que estrutura de design os dados batem ou quase batem** — 2^k completo, fração regular 2^(k-p) (com resolução e aliasing inferidos), CCD (variante por α inferido), Box-Behnken, 3^k, réplicas e pontos centrais detectados — todas as hipóteses ranqueadas, nunca só uma.
2. **Quais modelos são cabíveis com os dados como estão** — linear / +interações / +quadrático / completo, cada um classificado como estimável (com df de erro), saturado (Lenth) ou não estimável (com o motivo), via o MESMO guard de rank do motor de análise (ADR-007, reuso de `build_design_matrix`).
3. **Quais ensaios faltam para completar um planejamento** — corners faltantes do fatorial, axiais+centrais para virar CCD face-centered (default que não extrapola a faixa) ou rotatable, fold-over de fração III, e augmentation D-optimal gulosa para dados irregulares — com a lista concreta de combinações em valores naturais, copiável (TSV).
4. **Botão "Analisar com o melhor modelo"** — materializa a tabela como Experiment+Runs (`design_type=retrospective`, respostas incluídas) e cai na tela de análise existente com o melhor modelo estimável pré-selecionado.

## Camadas tocadas
- Backend: `retrospective_service.py` (núcleo puro: parse → inferência de escalas → classificação de runs → detecção de famílias em GF(2) → estimabilidade → completions), `routers/retrospective.py` (`POST /retrospective/diagnose` stateless + `POST /retrospective/materialize`), refactor de extração `analysis_service.build_design_matrix` (golden como guarda)
- Frontend: `containers/Retrospective.tsx` (split grid + card sticky, debounce 450ms), `components/RetroGrid.tsx` (grid de colunas dinâmicas com paste), `components/RetroDiagnosisCard.tsx`, `lib/retroTable.ts`, hook `useRetrospective`

## Novas adoções
Nenhuma lib nova (pyDOE3 para oráculos e D-optimal; numpy para GF(2)/rank).

## Critérios de aceitação
- [ ] Colar o dataset 2^3 da aula (solo-fibra-cimento) → card detecta "fatorial completo 2^3" e oferece completar para CCD
- [ ] Detector recupera família/resolução/α exatos de matrizes geradas pelo próprio pyDOE3 (naturais + ruído 1e-7 + shuffle + réplicas) — golden de detecção
- [ ] Remover N corners de um 2^k → `missing_runs` lista exatamente os N que faltam, em valores naturais
- [ ] Classificação de estimabilidade concorda com o guard do `analyze()` (mesma verdade, duas portas)
- [ ] Materializar → `POST /analysis` funciona no experimento sem nenhuma mudança no fluxo existente
- [ ] Linha inválida vira aviso no card (`row_issues`), nunca erro que derruba o diagnóstico
- [ ] Tolerâncias nomeadas e testadas (`CODED_SNAP_TOL`, `LEVEL_CLUSTER_REL`, `MIDPOINT_REL`, `ALPHA_MATCH_REL`)

## User stories cobertas
Escopo novo (2026-07-08): "às vezes a pessoa não planejou os ensaios e tem resultados já — precisa jogar tudo e o programa oferecer o estudo analítico mais completo, ou mostrar quais ensaios faltam pra terminar um fatorial".

## Blocked by
06

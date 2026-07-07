---
slug: doe-app
issue: 04
title: Motor de análise + golden test (o trilho)
status: aprovada
blocked_by: 03
---

## Pai
PRD: `docs/adp/doe-app-prd.md`

## O que construir
O núcleo estatístico: dada a matriz preenchida e um modelo de superfície de resposta escolhido, produzir ANOVA, efeitos, coeficientes e estatísticas de ajuste. Suporta os 4 modelos da aula (linear; linear+quadrático; linear+interações; completo) via builder de termos. Saídas: tabela ANOVA (SS/df/MS/F/p por termo + Pure Error + Lack-of-Fit + Total, com cabeçalho R²/Adj/MS Pure Error), tabela de efeitos (Effect/Std.Err/t/p/IC95%/Coeff codificado), coeficientes em unidades naturais e codificadas com VIF, painel de estatísticas (R²/R²aj/R²previsto-PRESS/RMSE/df). Guards obrigatórios: estimabilidade (`matrix_rank(X)` vs n_params → AVISA em vez de reportar número), saturado (0 df erro → Lenth PSE/half-normal), sinal (mapa fixo do qualitativo; cross-check OLS vs Yates). Este é o trilho: o golden test valida tudo. Roda por variável de resposta.

## Camadas tocadas
- Backend: `router (/analysis)` → `controller` → `AnalysisService` (statsmodels OLS + anova_lm typ=2) + `StatsService` (PRESS, Lenth PSE, VIF, Yates) → model `AnalysisResult`
- Frontend: `api` → `hook (useAnalysis)` → `container (Analysis)` → `presentational (ModelBuilder, AnovaTable, EffectsTable, CoefTable, StatsPanel, EstimabilityWarning)`

## Novas adoções
**statsmodels** (ols + anova_lm). BSD-3. Validado vs OriginPro (5 casas). Ver `docs/adp/reference-outputs.md`.

## Critérios de aceitação
- [ ] **CA1 (BLOQUEANTE)**: golden test 2² da aula (DP_50000) reproduz OriginPro — SS, F, p, R²=0.86692, Adj=0.81369, PRESS=20.61956, Predicted R²=0.65932, efeitos, coef — com `pytest.approx(rel=1e-6)`
- [ ] **CA2**: cross-check Montgomery Ex 6.1 (2³ nitride-etch) com `rel=1e-4`
- [ ] **CA4**: pedir quadrático num 2^k puro → AVISO explícito (não número); verificado por `matrix_rank`
- [ ] **CA5**: design saturado (0 df erro) → Lenth PSE/half-normal sem exceção
- [ ] **CA7**: efeito do qualitativo respeita o mapa fixo; OLS e Yates concordam
- [ ] Property test: ΣSS efeitos + SSE == SST
- [ ] Os 4 modelos RSM selecionáveis; ANOVA/efeitos/coef/stats renderizam por resposta

## User stories cobertas
24, 25, 26, 27, 28, 29, 30, 31, 32

## Blocked by
03

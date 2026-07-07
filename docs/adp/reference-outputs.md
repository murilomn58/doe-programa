# Outputs de referência da aula (Statistica / OriginPro)

Extraído dos slides "Exemplo 2 — Aplicação do DoE" (PDF lido página a página). O app deve reproduzir estes outputs, no mínimo, para o caso de teste da aula. Dois softwares aparecem: **Statistica** (fatores Tensão Desvio + Umidade, modelo com interação, Pure Error df=4) e **OriginPro** (fatores Condicao_de_Compactacao + Par_de_Tensao, modelo linear main-effects, Error df=5). Design em ambos: **fatorial 2² completo com 2 réplicas = 8 ensaios**.

> Nota: a aula descreve também o exemplo solo-fibra-cimento como **2³** (3 fatores). O app precisa ser genérico para 2^k; o 2² é o que aparece com números concretos nos slides e serve de **golden test**.

## ✅ VALIDAÇÃO EMPÍRICA — statsmodels reproduz o OriginPro (5 casas decimais)

Rodei os dados reais da aula (resposta DP_50000) no `statsmodels` (`ols('y ~ cond + par')` + `anova_lm typ=2`) e conferi contra o painel do OriginPro. **Bate exato**:

| Métrica | statsmodels | OriginPro |
|---------|-------------|-----------|
| Coef Intercept | 3.78512 | 3.78513 |
| Coef cond (effect) | 1.31712 (2.63425) | 1.31713 (2.63425) |
| Coef par (effect) | 2.19637 (4.39275) | 2.19638 (4.39275) |
| F cond / p | 8.61538 / 0.03244 | 8.61538 / 0.03244 |
| F par / p | 23.95706 / 0.00450 | 23.95706 / 0.0045 |
| R² / Adj R² | 0.86692 / 0.81369 | 0.86692 / 0.81369 |
| RMSE | 1.26921 | 1.26921 |
| **PRESS** | **20.61956** | **20.61956** |
| **Predicted R²** | **0.65932** | **0.65932** |
| Total SS | 60.52557 | 60.52557 |

**Conclusão: a metodologia central do app (statsmodels OLS + anova_lm + PRESS) está de-riscada.** Esses números viram o golden test primário.

### Dados de entrada do golden test (OriginPro, página 23)
Codificação: cond 18→−1, 19→+1; par (70,70)→−1, (210,70)→+1.

| Run | Std | cond | par | DP_10000 | DP_50000 |
|-----|-----|------|-----|----------|----------|
| 1 | 2 | +1 (19) | −1 (70,70) | 3.448 | 3.475 |
| 2 | 1 | −1 (18) | −1 (70,70) | 0.591 | 0.612 |
| 3 | 4 | +1 (19) | +1 (210,70) | 8.972 | 9.041 |
| 4 | 3 | −1 (18) | +1 (210,70) | 5.094 | 5.168 |
| 5 | 5 | −1 (18) | −1 (70,70) | 0.634 | 0.645 |
| 6 | 6 | +1 (19) | −1 (70,70) | 1.599 | 1.623 |
| 7 | 8 | +1 (19) | +1 (210,70) | 6.204 | 6.27 |
| 8 | 7 | −1 (18) | +1 (210,70) | 3.334 | 3.447 |

## 1. Tabela ANOVA (Tabela 4)
Cabeçalho: `ANOVA; Var.: Deformação Permanente; R-sqr=,88132; Adj:,79231; 2**(2-0) design; MS Pure Error=1,770662`

| Factor | SS | df | MS | F | p |
|---|---|---|---|---|---|
| (1) Tensão Desvio | 37,56711 | 1 | 37,56711 | 21,21642 | 0,009985 |
| (2) Umidade | 13,95504 | 1 | 13,95504 | 7,88126 | 0,048447 |
| 1 by 2 (interação) | 1,07311 | 1 | 1,07311 | 0,60605 | 0,479760 |
| Pure Error | 7,08265 | 4 | 1,77066 | | |
| Total SS | 59,67792 | 7 | | | |

**Valida:** SS, df, MS, F, p por termo + R² e R² ajustado no cabeçalho. Interação nomeada "1 by 2".

## 2. Estimativa dos Efeitos (Tabela 5)
Colunas: `Effect | Std.Err. Pure Err | t(4) | p | -95% Cnf.Limt | +95% Cnf.Limt | Coeff. | Std.Err. Coeff.`
- Mean/Interc.: Effect 3,734010; t 7,936910; p 0,001364
- (1) Tensão Desvio: Effect 4,334000; t 4,606128; p 0,009985; Coeff 2,167000
- (2) Umidade: Effect 2,641500; t 2,807358; p 0,048447; Coeff 1,320750
- 1 by 2: Effect 0,732500; t 0,778493; p 0,479760; Coeff 0,366250

## 3. Coeficientes de Regressão (Tabela 6)
Colunas: `Regressn Coeff | Std.Err. Pure Err | t(4) | p | -95% Cnf.Limt | +95% Cnf.Limt`
Modelo em unidades naturais (não codificadas): Mean/Interc. -15,3063; Tensão Desvio -0,0998; Umidade 0,7843; 1by2 0,0070.

## 4. Pareto Chart of Standardized Effects
Barras horizontais, ordenadas por magnitude do efeito padronizado (valor absoluto), com **linha vertical de significância em p=.05**. Rótulo do valor em cada barra.

## 5. Plot of Marginal Means and Conf. Limits (gráfico de interação)
Linhas de Deformação Permanente vs Tensão Desvio (eixo X), uma linha por nível de Umidade (18 / 19,5), com limites de confiança 95%.

## 6. Observed vs. Predicted Values
Scatter dos valores observados (X) vs preditos (Y) com **linha de referência 45°** (vermelha). Cabeçalho mostra `MS Residual`.

## Gráficos ADICIONAIS que o mercado (JMP/Minitab/Design-Expert) produz e o app deve ter
Além dos 6 acima, para designs com fatores quantitativos suficientes (RSM/CCD/Box-Behnken):
- **Superfície de resposta 3D** (surface plot) — resposta vs 2 fatores
- **Curvas de contorno 2D** (contour plot)
- **Gráfico de efeitos principais** (main effects plot)
- **Half-normal / normal probability plot** dos efeitos
- **Q-Q plot** e plots de resíduos (resíduo vs ajustado, vs ordem)
- **Cube plot** (3 fatores)

## Implicação de correção numérica
Estes números concretos (SS=37,56711; F=21,21642; p=0,009985; R²=0,88132…) são o alvo de **golden test**: o `AnalysisService` deve reproduzi-los a partir da matriz 2² com os dados da aula. Divergência = bug de cálculo (bloqueante no QA).

---

# Fluxo de INPUT do OriginPro (UI a replicar)

O app deve oferecer um fluxo de setup tão bom quanto o do OriginPro (referência de UX). Telas observadas nos slides:

## Dialog "Factorial Design" — aba Factors (página 21)
- **Factorial Type**: 2-Level Factorial · Plackett-Burman · General Full Factorial (radio)
- **Generators**: Default · Custom
- Botão "Display Available Designs"
- Abas: Factors · Settings · Miscellaneous · Output · Dialog Theme
- **Number of Factors**: dropdown (ex: 2)
- Tabela de fatores: `Factor (A/B) | Name | Type (Numeric/Text) | Low | High`
  - Ex: A = Condicao de Compactação, Numeric, Low=18, High=19
  - Ex: B = Par de Tensão, **Text** (qualitativo), Low=(70,70), High=(210,70)

## Dialog "Factorial Design" — aba Settings (página 22)
- Tabela Designs: `Design | Runs | Resolution | 2^(k-p)` (ex: Full factorial | 4 | Full | 2²)
- "Number of total runs is 8"
- **Number of Center Points per Block** (ex: 0)
- **Number of Blocks** (ex: 1)
- **Number of Replicates** (ex: 2)
- Toggle **Block on Replicates**

## Workbook gerado (páginas 20, 23)
Colunas: `Run Order | Std Order | Point Type | Blocks | Replicates | <Fator1> | <Fator2> | ... | <Resposta1> | <Resposta2>`
- Fatores e respostas viram colunas; respostas preenchidas pelo usuário (células editáveis).

## Dialog "Analyze Factorial Design" (página 24)
- Ribbon DoE: Power and Sample Size · Define Custom Design · **Analyze Design** · Optimize Response
- Abas: **Model · Settings · Quantities · Fits and Diagnostics · Plots**
- **Response**: dropdown (escolhe qual resposta analisar: DP_10000 / DP_50000)
- **Model Terms** (builder de termos) · Include Blocks in the Model

# Outputs ADICIONAIS do OriginPro (além dos 6 do Statistica)

## Coded Coefficients (com VIF) — página 26
Colunas: `Effect | Value | Standard Error | 95% LCL | 95% UCL | t-Value | Prob>|t| | VIF`
→ Incluir **VIF** (variance inflation factor) para diagnóstico de multicolinearidade.

## Painel Statistics — página 27
- Degrees of Freedom · Root Mean Square of Error · R-Square · Adj. R-Square · **PRESS** · Residual Sums of Squares · **Predicted R-Square**

## Gráficos OriginPro (páginas 28-30)
- **Effect Plot** (Pareto de efeitos padronizados por termo)
- **Main Effects Plot** (média da resposta por nível de cada fator, painéis lado a lado)
- **Normal Probability Plot** dos resíduos (Probability × Regular Residual)
- **Observed vs Predicted**

Todos estes já estão cobertos na lista de 13 gráficos em [research-findings.md](research-findings.md).

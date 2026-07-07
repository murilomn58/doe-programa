# DoE_programa — Contexto e ADRs

## Glossário do domínio

| Termo | Definição |
|-------|-----------|
| Fator (X) | Variável de entrada controlada pelo experimentador |
| Nível | Valor específico de um fator (ex: temperatura = 60°C, 80°C) |
| Resposta (Y) | Variável de saída medida (ex: Módulo de Resiliência) |
| Ensaio / Run | Linha da matriz: uma combinação específica de níveis |
| Réplica | Repetição do mesmo ensaio para estimar erro experimental |
| Codificação | Transformação -1/+1 dos níveis naturais (padrão da literatura) |
| Efeito principal | Influência direta de um fator Xi na resposta Y |
| Interação | Efeito combinado Xi·Xj na resposta Y |
| Ponto central | Run com todos os fatores no nível médio (para curvatura) |
| Ponto axial (α) | Ponto além dos extremos, usado no CCD |
| R² ajustado | Coeficiente de determinação penalizado pelo número de termos |
| Falta de ajuste | Teste estatístico se o modelo é adequado aos dados |
| Pareto de efeitos | Gráfico de barras ordenado por magnitude dos efeitos |

## ADRs (Architectural Decision Records)

### ADR-001: Python para cálculos, Next.js para UI
**Motivo**: scipy/numpy/statsmodels têm implementações DoE de nível científico que seriam complexas de reimplementar em JS. A separação também permite hospedar o backend no Railway e o frontend no Vercel futuramente.

### ADR-002: Plotly.js para todos os gráficos
**Motivo**: Único lib JS com suporte nativo a gráficos 3D de superfície interativos (plotly surface), curvas de contorno (contour), diagramas de Pareto e Q-Q plots — exatamente os outputs de DoE/RSM.

### ADR-003: SQLite em dev, PostgreSQL em prod
**Motivo**: Zero config para uso local offline. Migração trivial via SQLAlchemy quando for hospedar.

### ADR-004: pyDOE3 1.6.2 como lib ÚNICA de geração ⚠️ CORRIGIDA 2x (VERIFICADA)
**Decisão final (verificada empiricamente, Jul/2026)**: **`pyDOE3==1.6.2`** é a lib única de geração. Instalada e testada localmente: cobre clássico (`ff2n`, `fullfact`, `fracfact`, `fracfact_by_res`, `fracfact_aliasing`, `ccdesign`, `bbdesign`, `pbdesign`, `gsd`) + **Taguchi** (`doe_taguchi`: `get_orthogonal_array`, `taguchi_design`, `compute_snr`) + **D/I-optimal** (`doe_optimal`: `optimal_design`, `d_optimality`, `i_optimality`, `fedorov`, `detmax`). BSD-3, deps só numpy+scipy, Python puro (bundle offline trivial). **NÃO usar pyDOE2 nem "pydoe 1.3.0"** (é o pyDOE2 renomeado, sem Taguchi). Única família separada: **DSD categórico** via `definitive-screening-design 0.5.0` (vendorar `design.py`). `pyoptex` só se split-plot for necessário (Fase 2). Detalhes: `docs/adp/design-libs-decision.md`.

### ADR-005: Codificação -1/+1 explícita como padrão interno
**Motivo**: Padrão da literatura estatística para DoE. A UI mostra os valores naturais; o backend trabalha codificado internamente. **Decisão reforçada**: usar colunas numéricas ±1 **explícitas** + OLS, NÃO o Sum coding do patsy (`C(x, Sum)`) — o Sum coding põe +1 no primeiro nível alfabético e pode **inverter o sinal do efeito silenciosamente**. Persistir o mapa `{-1:'Tucum', +1:'Piassava'}` para exibir níveis naturais.

### ADR-006: statsmodels como motor único de análise (VALIDADO)
**Motivo**: `statsmodels` (`formula.api.ols` + `stats.anova.anova_lm typ=2`) reproduz OriginPro/Statistica/JMP/Minitab. **Validado empiricamente** contra os números da aula (5 casas decimais — ver reference-outputs.md). `pingouin` só como validação cruzada opcional (é GPL-3.0 copyleft, não pode ser dep obrigatória).

### ADR-007: Guard de estimabilidade OBRIGATÓRIO
**Motivo**: statsmodels OLS usa `pinv` → devolve coeficientes finitos **silenciosos** em design rank-deficiente (não retorna NaN, não lança exceção). Todo cálculo deve checar `np.linalg.matrix_rank(X)` vs `n_params` ANTES de reportar. Termo quadrático num 2^k puro é aliased com o intercepto (x²=1). Modelos com quadráticos exigem CCD/Box-Behnken. Design saturado (sem réplica, 0 df erro) → cair para Lenth PSE / half-normal.

### ADR-008: Visualização com render duplo
**Motivo**: **Plotly.js** (browser, interativo, `dynamic ssr:false`) para exploração; **matplotlib + SciencePlots** (server-side) para export de publicação. 2D → vetor SVG/PDF; superfície 3D → raster PNG/TIFF 600 DPI (nem WebGL nem mplot3d dão vetor 3D limpo). Colormap `viridis`. TODO array calculado no backend; frontend só desenha.

### ADR-009: PDF via Playwright (Windows), WeasyPrint reservado
**Motivo**: **Playwright** (Chromium headless) renderiza a rota `/report` do Next.js → PDF pixel-perfect, 1 comando de instalação no Windows, sem MSYS2/Pango/GTK e ainda renderiza Plotly ao vivo. WeasyPrint fica para deploy Linux/Docker (com gráficos embutidos como PNG). Tabelas: pandas + XlsxWriter (multi-aba); CSV PT-BR (`sep=';'`, `decimal=','`, `utf-8-sig`).

## Exemplo de referência (da aula)
Experimento solo-fibra-cimento com 3 fatores:
- X1: Tipo de fibra (Tucum/Piassava) — qualitativo
- X2: % de fibra (0% / 1.5%) — quantitativo
- X3: % de cimento (0% / 2%) — quantitativo
- Respostas: Módulo de Resiliência (MR), Deformação Permanente
- Modelo: Fatorial Completo 2^3 = 8 ensaios

Este exemplo deve funcionar como caso de teste de ponta a ponta no QA.

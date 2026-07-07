# Pesquisa consolidada — stack, métodos e visualização de DoE

> Resultado do workflow de pesquisa (6 dimensões + verificação adversarial + síntese), Jul/2026. Cada recomendação abaixo passou por um verificador adversarial que tentou refutá-la. As decisões load-bearing estão marcadas.

## Stack recomendada (verificada)

| Camada | Escolha | Motivo |
|--------|---------|--------|
| **Geração de design** | `pydoe==1.3.0` (core) + `pyDOE3==1.6.2` (fallback pinado) | BSD-3, deps só numpy+scipy (ideal offline). ⚠️ **NÃO usar pyDOE2** (irmão estagnado — corrige ADR-004). Funções: `ff2n`, `fullfact`, `fracfact`, `fracfact_by_res`, `fracfact_aliasing`, `ccdesign`, `bbdesign`, `pbdesign`, `gsd`. Space-filling: `scipy.stats.qmc.LatinHypercube`. |
| **Análise** | `statsmodels` (`ols` + `anova_lm` typ=2) | ✅ **VALIDADO empiricamente**: reproduz OriginPro com precisão de 5 casas decimais (ver reference-outputs.md). + `scipy.stats` (shapiro/anderson/f.sf/t.sf) + `numpy.linalg` (guard de rank). ⚠️ `pingouin` só validação opcional — é GPL-3.0 (copyleft). |
| **Visualização** | **Render duplo**: Plotly.js (browser interativo) + matplotlib + SciencePlots (export publicação, server-side) | 2D → vetor SVG/PDF real; 3D → raster PNG/TIFF **600 DPI** (WebGL e mplot3d não dão vetor 3D limpo). Colormap `viridis` (consistente entre browser e PDF). |
| **Relatório PDF** | **Playwright** (Chromium headless) renderiza rota `/report` do Next.js → PDF pixel-perfect | 1 comando de instalação no Windows, sem MSYS2/Pango/GTK. WeasyPrint reservado para deploy Linux/Docker. |
| **Export tabelas** | `pandas` + `XlsxWriter` (Excel multi-aba) + CSV PT-BR (`sep=';'`, `decimal=','`, `utf-8-sig`) | Abas: ANOVA / Coeficientes / Matriz de projeto. |
| **Backend** | Python FastAPI empacotado offline + SQLAlchemy | Confirma ADR-001. |
| **Frontend** | Next.js 15 + TS + react-plotly.js (`dynamic`, `ssr:false`) | Confirma ADR-002. |
| **Banco** | SQLite (dev) → PostgreSQL (prod) via SQLAlchemy | Confirma ADR-003. |

## Modelos de design (ordem de implementação)

1. **Fatorial completo 2^k** (`ff2n`) — desbloqueia o caso da aula (2³ solo-fibra + golden 2²). Estima modelos **(1) linear** e **(3) linear+interações**.
2. **2^k + pontos centrais** — habilita erro puro, lack-of-fit e **detecção** de curvatura (não estima β_ii individuais).
3. **CCD** (`ccdesign`, center=(nc_fat,nc_ax), alpha rotatable=(2^k)^(1/4)) — **obrigatório para estimar termos quadráticos** (modelos 2 e 4). Fator qualitativo não entra → 1 CCD por categoria.
4. **Box-Behnken** (`bbdesign`, k≥3) — RSM de 3 níveis, alternativa ao CCD.
5. **Fatorial fracionado 2^(k-p)** (`fracfact` + `fracfact_by_res` + `fracfact_aliasing`) — screening.
6. **Fase 2**: gsd multinível, Plackett-Burman, D/I-optimal (pyoptex), DSD categórico.

## Guards de correção matemática (LOAD-BEARING — não pular)

1. **Guard de estimabilidade OBRIGATÓRIO**: statsmodels OLS usa `pinv` → devolve coeficientes finitos **silenciosos** em design rank-deficiente (NÃO retorna NaN, NÃO lança exceção). O app **deve** checar `np.linalg.matrix_rank(X)` vs `n_params` ANTES de reportar. Termo quadrático num 2^k puro é aliased com o **intercepto** (x²=1, constante).
2. **Modelos com quadráticos não são estimáveis de 2^k puro** — comunicar na UI e sugerir "adicionar center points / virar CCD".
3. **Footgun de sinal**: patsy Sum coding põe +1 no primeiro nível alfabético → pode inverter sinal do efeito silenciosamente. Usar **colunas numéricas ±1 explícitas + OLS** e persistir o mapa `{-1:'Tucum', +1:'Piassava'}`.
4. **Guard n=1 (saturado)**: o 2³ solo-fibra não tem réplica → modelo completo satura (0 df de erro). Testar que o app avisa "sem df de erro" e cai para **Lenth PSE / half-normal**, em vez de dividir por zero.

## Gráficos (13 tipos — cobrem JMP/Minitab/Design-Expert/OriginPro)

| Gráfico | Dim | Browser (Plotly) | Export (matplotlib) |
|---------|-----|------------------|---------------------|
| Superfície de resposta 3D | 3D | `surface` | mplot3d (raster 600 DPI) |
| Contorno 2D | 2D | `contour` | `contourf` (vetor) |
| Pareto de efeitos padronizados (linha p=.05) | 2D | `bar` | vetor |
| Half-normal / normal plot dos efeitos | 2D | scatter | scipy.stats.norm.ppf |
| Efeitos principais (main effects) | 2D | scatter+line | matplotlib |
| Interação (marginal means, IC95%) | 2D | scatter | statsmodels interaction_plot |
| Cube plot (3 fatores) | 3D | `scatter3d` | matplotlib 3D |
| Observado vs predito (reta 45°, R²) | 2D | scatter | matplotlib |
| Q-Q plot dos resíduos | 2D | scatter | statsmodels ProbPlot |
| Resíduos vs ajustado e vs ordem | 2D | scatter | matplotlib |
| Resíduos vs leverage + Cook | 2D | scatter | statsmodels influence_plot |
| Overlay de desejabilidade (multi-resposta) | 2D/3D | contour/surface | matplotlib |
| **Prediction/Contour Profiler interativo** (diferencial JMP) | 2D | Plotly + backend | — |

**Regra de ouro**: TODO cálculo/array (grid Z, efeitos, t, PSE, resíduos, quantis) fica no **backend Python**; o frontend só desenha. Uma fonte de verdade.

## Anti-escopo (com motivo)

> ⚠️ **Decisão de escopo (Gate 1) sobrepõe a recomendação da pesquisa**: o Murilo escolheu **full RSM no v1** e trouxe **Taguchi + D-optimal/DSD categórico para o v1** (resolvem o fator qualitativo "tipo de fibra"). A autoridade sobre escopo é o [brief](doe-app-brief.md), não este doc. As linhas abaixo marcadas ~~riscadas~~ foram promovidas ao v1.

- Designs de **mistura** (mixture) — fora do caso solo-fibra. *(continua fora)*
- **Split-plot** / hard-to-change factors — não requerido. *(continua fora)*
- **Otimização Bayesiana / design adaptativo** (baybe, BoFire) — **Fase 2** (após primeiro teste).
- ~~D-optimal / DSD categórico~~ → **PROMOVIDO AO v1** (pyoptex em RC — monitorar maturidade).
- ~~Taguchi / Plackett-Burman~~ → **PROMOVIDO AO v1** (Taguchi requer verificação de lib OA na fase PRD).
- `pingouin` como dep obrigatória — GPL-3.0.
- Superfície 3D em vetor "de journal" — entregar raster 600 DPI (pragmático, aceito por periódicos).
- WeasyPrint no Windows — usar Playwright.
- Multi-tenant / auth / nuvem — app é de uso pessoal offline.
- Reimplementar geração de matriz ou ANOVA/OLS à mão — reusar pydoe + statsmodels.

## Riscos monitorados

- `pydoe 1.3.0` muito recente (jun/2026) → pinar exato + golden-matrix tests + fallback `pyDOE3==1.6.2`.
- Guard de rank silencioso (ver acima) — o maior risco de "números plausíveis porém errados".
- Kaleido v1 depende de Chromium externo → preferir export SVG no cliente (`Plotly.toImage`) + POST ao backend, ou render via Playwright.

## Fontes principais
pydoe (github.com/pydoe/pydoe), pyDOE3 (github.com/relf/pyDOE3), statsmodels.org, SciencePlots, NIST/SEMATECH e-Handbook, Montgomery "Design and Analysis of Experiments", Playwright docs.

---
slug: doe-app
title: Aplicativo web de Design of Experiments (DoE)
status: aprovado
gate: escopo (Gate 1) — APROVADO em 2026-07-06
scope: v1 = full RSM + Taguchi + designs ótimos/DSD com fator qualitativo
created: 2026-07-06
---

# Brief — Aplicativo de Design of Experiments (DoE)

## Problema
Pesquisadores de engenharia de materiais (ITA/IME) precisam planejar experimentos e analisar resultados com rigor estatístico, mas as ferramentas do mercado (JMP, Minitab, Design-Expert, OriginPro) custam US$ 1-2,4k/ano, são desktop e exigem licença. Não existe nenhum app web open-source que integre **geração de design + entrada de dados + análise (ANOVA/RSM) + gráficos de publicação**. Quem sofre: o próprio pesquisador (Murilo), que hoje depende de licença estudantil do OriginPro (renovável a cada 6 meses) para a pesquisa solo-fibra-cimento.

## Critérios de sucesso (testáveis)
1. **Golden test da aula**: dado o fatorial 2² com os dados da aula, o app reproduz os números do OriginPro/Statistica — SS, F, p, R², Adj R², PRESS, Predicted R², efeitos e coeficientes — com tolerância `rel=1e-6`. ✅ *Já validado que statsmodels bate em 5 casas decimais.*
2. **Fluxo ponta a ponta**: criar experimento → escolher modelo (2^k / fracionado / CCD / Box-Behnken) → gerar matriz → preencher respostas → rodar análise → ver os gráficos → exportar. Sem tocar em código.
3. **Gráficos de publicação**: exportar superfície 3D, contorno, Pareto, efeitos principais, interação, obs-vs-predito e diagnósticos de resíduos em PNG/SVG de alta resolução prontos para artigo.
4. **Relatório PDF** de um clique com tabelas + gráficos + interpretação.
5. **Export tabelas**: ANOVA e coeficientes em CSV (PT-BR) e Excel multi-aba.
6. **100% offline**, sem auth, sem instalação de licença.
7. **Guardas de correção**: o app avisa quando um termo (ex: quadrático num 2^k puro) não é estimável pelo design, em vez de mostrar número errado.

## Abordagem escolhida
Monorepo **Next.js 15 (frontend) + Python FastAPI (backend)**, cálculos 100% no Python, gráficos renderizados no frontend (Plotly.js) e exportados no backend (matplotlib+SciencePlots).

- **Geração**: `pydoe 1.3.0` (fallback `pyDOE3 1.6.2`). Corrige a escolha inicial de pyDOE2.
- **Análise**: `statsmodels` (ols + anova_lm typ=2) — validado vs OriginPro. Guard de estimabilidade obrigatório (`np.linalg.matrix_rank`).
- **Visualização**: render duplo — Plotly.js (browser interativo) + matplotlib/SciencePlots (export publicação; 2D vetor, 3D raster 600 DPI).
- **Relatório/Export**: Playwright (PDF), XlsxWriter (Excel), CSV PT-BR.
- **Banco**: SQLite (dev) → PostgreSQL (prod) via SQLAlchemy.

*Alternativas descartadas*: Streamlit (menos controle visual dos gráficos); cálculo client-side em JS (reimplementaria álgebra linear de nível científico); pyDOE2 (irmão estagnado); pingouin como dep (GPL-3.0); WeasyPrint no Windows (dor de Pango/GTK).

## Decisões e termos
Ver glossário e ADR-001..009 em [CONTEXT.md](CONTEXT.md). Termos-chave: Fator, Nível, Resposta, Ensaio/Run, Réplica, Codificação ±1, Efeito, Interação, Ponto central, Ponto axial, R² ajustado/previsto, Lack-of-fit, Pareto de efeitos, PRESS, Lenth PSE, VIF.

## Restrições
- Stack: Next.js 15 + Python FastAPI + SQLite (deploy futuro Vercel + Railway).
- Offline-first; uso pessoal (sem multi-tenant/auth/LGPD relevante — sem dado de terceiros).
- Windows como ambiente de dev (define escolha de Playwright > WeasyPrint).
- Bibliotecas com licença permissiva (BSD/MIT/Apache); evitar copyleft (GPL) em deps obrigatórias.

## Estado da arte (tabela de fusão — só o que decidiu)
| Achado | Fonte | Destino |
|--------|-------|---------|
| Nenhum web app OSS completo de DoE | radar GitHub/awesome-doe | **Mesa** — o app preenche um gap real |
| JMP/Minitab/Design-Expert $1-2,4k/ano desktop | G2, Medium | **Mesa** — justifica app offline grátis |
| `pydoe`/`pyDOE3` é o core mantido (pyDOE2 estagnado) | github.com/pydoe, relf/pyDOE3 | **Opção→decisão** — corrige ADR-004 |
| statsmodels reproduz JMP/Minitab | statsmodels docs + validação própria | **Opção→decisão** — motor de análise |
| OLS(pinv) não retorna NaN em design singular | verificação adversarial | **Risco→guard obrigatório** (ADR-007) |
| Quadrático não estimável de 2^k puro | verificação adversarial | **Anti-escopo parcial** — exige CCD/center points, avisar na UI |
| Plotly 3D/mplot3d não dão vetor 3D limpo | verificação adversarial | **Decisão** — 3D como raster 600 DPI |
| Playwright > WeasyPrint no Windows | verificação adversarial | **Decisão** — PDF via Playwright (ADR-009) |
| SALib/BoFire = problema diferente | radar | **Anti-escopo** — não incluir |

## Riscos e perguntas em aberto
- `pydoe 1.3.0` muito recente → pinar exato + golden-matrix tests + fallback pyDOE3.
- Guard de rank silencioso é o maior risco de "número plausível porém errado".
- Modelos com quadráticos exigem CCD/BBD — a UX precisa guiar o usuário nisso sem confundir.

## Escopo do v1 (Gate 1 aprovado) — FULL RSM + designs para fator qualitativo
Decisão do Murilo: entregar o conjunto completo de uma vez.

**Modelos de design no v1:**
1. Fatorial completo 2^k (`ff2n`) + geral multinível (`fullfact`/`gsd`)
2. Fatorial fracionado 2^(k-p) (`fracfact` + resolução + aliasing)
3. Fatorial + pontos centrais (curvatura + lack-of-fit)
4. CCD — Central Composite (`ccdesign`, rotatable/orthogonal/face-centered)
5. Box-Behnken (`bbdesign`)
6. **Taguchi** (arranjos ortogonais L4/L8/L9/L16/L18…) — ⚠️ requer verificação de lib na fase PRD (candidatos: `oapackage`, tabelas OA pré-computadas, ou `gsd`)
7. **Plackett-Burman** (`pbdesign`)
8. **Designs ótimos D/I com fator qualitativo** (`pyoptex` / `optimal_design`) e **DSD categórico** (`definitive_screening_design`) — resolvem o "tipo de fibra" (Tucum/Piassava) participando de RSM, que CCD/BBD não aceitam. ⚠️ pyoptex está em release candidate (risco de maturidade a monitorar).

**Análise no v1:** os 4 modelos de superfície de resposta da aula (linear; linear+quadrático; linear+interações; completo), ANOVA com Pure Error + Lack-of-Fit, R²/R²aj/R²previsto, efeitos+coef+VIF+IC, Lenth PSE, diagnósticos de resíduos. Guards de estimabilidade.

**Visualização/Export no v1:** os 13 gráficos + PDF + Excel + CSV + PNG/SVG 600 DPI.

## Fora de escopo
- **Fase 2** (após primeiro teste): otimização Bayesiana / design adaptativo (baybe/BoFire) e "outras coisas".
- **Fora (nunca no horizonte atual)**: multi-tenant / auth / nuvem (app é offline pessoal); análise de sensibilidade Sobol/Morris (SALib — outra família); designs de mistura; split-plot; superfície 3D em vetor puro (usar raster 600 DPI).

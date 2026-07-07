---
slug: doe-app
title: PRD — Aplicativo web de Design of Experiments (DoE)
status: aprovado
gate: PRD (Gate 2) — APROVADO em 2026-07-06
depends_on: doe-app-brief.md (Gate 1 aprovado)
created: 2026-07-06
resolved: Q2 (split-plot) = NÃO — fibra tratada como fácil-de-mudar; pyoptex fora do v1 (exchange leve pyDOE3)
---

# PRD — Aplicativo de Design of Experiments (DoE)

## Problema
O pesquisador (ITA/IME, engenharia de materiais — pesquisa solo-fibra-cimento) precisa planejar experimentos e analisar resultados com rigor estatístico, mas depende de software desktop caro e licenciado (OriginPro/JMP/Minitab). Não há alternativa web offline que una geração de design, entrada de dados, análise (ANOVA/RSM) e gráficos de publicação. Ele quer uma ferramenta própria, grátis, offline, que reproduza (e supere em UX) o fluxo do OriginPro e gere gráficos lindos para artigos.

## Solução
Um app web local (Next.js + FastAPI) onde o pesquisador: (1) cria um experimento definindo fatores e níveis; (2) escolhe um modelo de planejamento (fatorial 2^k, fracionado, CCD, Box-Behnken, Taguchi, D/I-optimal, DSD); (3) recebe a matriz de ensaios gerada; (4) preenche as respostas numa planilha intuitiva; (5) roda a análise (ANOVA, R²/R²aj/R²previsto, efeitos, coeficientes, diagnósticos) escolhendo o modelo de superfície de resposta; (6) explora gráficos 2D/3D interativos; (7) exporta gráficos de publicação (PNG/SVG 600 DPI), tabelas (CSV/Excel) e um relatório PDF completo. O app avisa quando um termo do modelo não é estimável pelo design escolhido, em vez de mostrar número errado.

## User Stories

### A. Gerenciamento de experimentos
1. Como pesquisador, quero criar um experimento com nome e descrição, para organizar meus estudos.
2. Como pesquisador, quero ver a lista de experimentos salvos com data e status, para retomar o trabalho.
3. Como pesquisador, quero abrir, editar e excluir um experimento, para gerenciar meus dados.
4. Como pesquisador, quero duplicar um experimento, para testar variações sem recomeçar.
5. Como pesquisador, quero que tudo persista localmente (offline), para não perder trabalho sem internet.

### B. Definição de fatores e níveis
6. Como pesquisador, quero adicionar N fatores, cada um com nome, tipo (quantitativo/qualitativo) e unidade, para descrever meu experimento.
7. Como pesquisador, quero definir níveis de um fator quantitativo por valor baixo/alto (e opcionalmente níveis intermediários), para o design 2-níveis ou multinível.
8. Como pesquisador, quero definir níveis de um fator qualitativo por rótulos (ex: Tucum/Piassava), para fatores categóricos.
9. Como pesquisador, quero definir uma ou mais variáveis de resposta (nome + unidade), para medir múltiplos resultados (ex: MR e Deformação Permanente).
10. Como pesquisador, quero ver a codificação ±1 aplicada aos meus níveis naturais, para entender a matriz.

### C. Geração da matriz de design
11. Como pesquisador, quero escolher o tipo de design entre: Fatorial completo 2^k, Fatorial geral multinível, Fatorial fracionado 2^(k-p), Fatorial + pontos centrais, CCD, Box-Behnken, Taguchi, Plackett-Burman, D/I-optimal, DSD — para o objetivo do meu estudo.
12. Como pesquisador, quero configurar réplicas, pontos centrais, blocos e (no fracionado) resolução/geradores, para ajustar o design.
13. Como pesquisador, quero ver o número de ensaios resultante antes de gerar, para avaliar viabilidade.
14. Como pesquisador, quero que a matriz seja gerada com colunas Run Order (randomizada), Std Order, Point Type, Blocks, Replicates e os fatores — no estilo OriginPro.
15. Como pesquisador, no fracionado, quero ver a estrutura de aliasing/confounding e a resolução, para saber o que perco.
16. Como pesquisador (Taguchi), quero escolher um arranjo ortogonal (L4/L8/L9/L12/L16/L18/L27…) compatível com meus fatores, e ver aviso se não couberem nas colunas.
17. Como pesquisador (D/I-optimal), quero gerar um design ótimo que inclua meu fator qualitativo numa RSM, para o caso onde CCD/BBD não servem.
18. Como pesquisador (DSD), quero um Definitive Screening Design com fatores categóricos de 2 níveis, para triagem eficiente.

### D. Entrada de dados
19. Como pesquisador, quero preencher as respostas de cada ensaio numa tabela editável estilo planilha, para lançar meus resultados de laboratório.
20. Como pesquisador, quero navegar por teclado (Tab/Enter/setas) entre células, para lançar dados rápido.
21. Como pesquisador, quero colar dados de uma planilha externa (Excel), para não redigitar.
22. Como pesquisador, quero que respostas parciais sejam salvas, para continuar depois.
23. Como pesquisador, quero validação de entrada (número válido, avisos de célula vazia), para evitar erro de lançamento.

### E. Análise estatística
24. Como pesquisador, quero escolher o modelo de superfície de resposta entre os 4 da aula (linear; linear+quadrático; linear+interações; completo), para analisar meus dados.
25. Como pesquisador, quero um builder de termos (marcar/desmarcar efeitos principais, interações, quadráticos), para modelos customizados.
26. Como pesquisador, quero a tabela ANOVA completa (SS, df, MS, F, p por termo + Pure Error + Lack-of-Fit + Total), para avaliar significância — reproduzindo o cabeçalho estilo aula (R-sqr, Adj, MS Pure Error).
27. Como pesquisador, quero a tabela de efeitos (Effect, Std.Err, t, p, IC95%, Coeff codificado), para quantificar cada fator.
28. Como pesquisador, quero os coeficientes de regressão em unidades naturais e codificadas, com VIF, para escrever o modelo preditivo.
29. Como pesquisador, quero o painel de estatísticas (R², R²aj, R²previsto/PRESS, RMSE, df), para julgar a qualidade do ajuste.
30. Como pesquisador, quero um aviso claro quando um termo (ex: quadrático num 2^k puro) não é estimável pelo design, para não reportar número sem sentido.
31. Como pesquisador (design saturado, sem réplica), quero que o app caia para Lenth PSE / half-normal em vez de dividir por zero, para ainda ter uma análise de efeitos.
32. Como pesquisador, quero rodar a análise por variável de resposta separadamente (MR, DP), para comparar.

### F. Visualização
33. Como pesquisador, quero superfície de resposta 3D interativa (resposta vs 2 fatores), para visualizar a RSM.
34. Como pesquisador, quero curvas de contorno 2D, para ler iso-linhas da resposta.
35. Como pesquisador, quero o gráfico de Pareto dos efeitos padronizados com linha de significância p=.05, para ver o que importa.
36. Como pesquisador, quero half-normal/normal plot dos efeitos, para designs saturados.
37. Como pesquisador, quero o gráfico de efeitos principais e o de interação (marginal means com IC95%), para interpretar.
38. Como pesquisador, quero cube plot (3 fatores), observado-vs-predito, Q-Q plot e plots de resíduos (vs ajustado, vs ordem, leverage/Cook), para diagnóstico.
39. Como pesquisador (multi-resposta), quero overlay de contorno/desejabilidade, para achar a região que atende MR e DP juntos.
40. Como pesquisador, quero um profiler interativo (arrastar um fator e ver a resposta mudar), para explorar o modelo.
41. Como pesquisador, quero escolher qual par de fatores plotar (fixando os demais no centro), para explorar todas as combinações.

### G. Export e relatório
42. Como pesquisador, quero exportar qualquer gráfico em PNG e SVG de alta resolução (600 DPI), para colocar no artigo.
43. Como pesquisador, quero exportar a matriz de projeto e as tabelas (ANOVA, coeficientes) em CSV (PT-BR: `;` e `,` decimal) e Excel multi-aba, para processar/publicar.
44. Como pesquisador, quero gerar um relatório PDF de um clique com fatores, matriz, tabelas, gráficos e interpretação, para documentar o estudo.

### H. Erros e borda
45. Como pesquisador, quero mensagem clara se eu pedir um design impossível (ex: Box-Behnken com <3 fatores), para corrigir.
46. Como pesquisador, quero aviso se o número de fatores não couber no arranjo Taguchi escolhido, para escolher outro.
47. Como pesquisador, quero aviso se tento analisar sem preencher todas as respostas, para completar antes.
48. Como pesquisador, quero que o app nunca mostre um número calculado sobre matriz singular sem me avisar da não-estimabilidade.
49. Como pesquisador, quero que o fator qualitativo em CCD/Box-Behnken seja bloqueado com explicação (rodar 1 design por categoria ou usar D-optimal/DSD), para não gerar design inválido.

## Critérios de aceitação
Herdados do brief e ligados aos seams (ver Decisões de teste). Cada critério é o que a Fase 4 (QA) verifica.

- **CA1 — Golden test da aula (BLOQUEANTE)**: dado o fatorial 2² com os dados da aula (resposta DP_50000), o `AnalysisService` reproduz os números do OriginPro (SS, F, p, R²=0.86692, Adj=0.81369, PRESS=20.61956, Predicted R²=0.65932, efeitos, coeficientes) com `pytest.approx(rel=1e-6)`. *(já validado em spike; virar teste automatizado)*
- **CA2 — Cross-check Montgomery Ex 6.1**: o motor reproduz o 2³ nitride-etch (efeitos A=−101.625, C=306.125, AC=−153.625; SS_C=374850.06; F_C=166.41; R²=0.9661) com `rel=1e-4`.
- **CA3 — Geração correta por família**: cada tipo de design gera a matriz esperada (nº de ensaios, codificação ±1, aliasing no fracionado, catálogo Taguchi) — golden-matrix tests contra pyDOE3.
- **CA4 — Guard de estimabilidade**: pedir um termo quadrático num 2^k puro produz um AVISO explícito (não um número), verificado por `matrix_rank(X) < n_params`.
- **CA5 — Guard saturado**: design sem réplica (0 df de erro) cai para Lenth PSE/half-normal sem exceção.
- **CA6 — Fluxo ponta a ponta**: via API, criar experimento → gerar design → salvar respostas → analisar → obter dados de gráfico → exportar, tudo sem erro (teste de integração).
- **CA7 — Sinal correto**: efeito de fator qualitativo respeita o mapa fixo (Tucum=−1/Piassava=+1); duas implementações (statsmodels OLS + Yates numpy) concordam.
- **CA8 — Export**: PDF gerado contém tabelas + gráficos; Excel tem abas ANOVA/Coeficientes/Matriz; CSV em formato PT-BR; PNG/SVG em 600 DPI.
- **CA9 — Visual**: as 5 telas renderizam sem erro de console; os gráficos-chave (superfície 3D, contorno, Pareto, obs-vs-predito) aparecem (verificação Playwright/qa-frontend).
- **CA10 — Offline**: todo o fluxo funciona sem rede; nenhuma chamada externa em runtime.

## Decisões de arquitetura
Monorepo: `backend/` (Python FastAPI) + `frontend/` (Next.js 15). Cálculo 100% no backend; frontend só renderiza (uma fonte de verdade). Convenções: backend `router→controller→service→repository` (skill `backend-layers`); frontend `api→hook→container→presentational` (skill `frontend-react`). ADR-001..009 em CONTEXT.md.

**Módulos backend (a criar):**
- **Domínio/persistência**: models `Experiment`, `Factor`, `Level`, `Run`, `Response`, `AnalysisResult` (SQLAlchemy); schemas Pydantic; enums `DesignType`, `FactorType`, `RSMModel`, `SNRObjective`. Repository de experimentos. Migrations Alembic. *(fundação — todos dependem)*
- **DesignService**: porta única de geração, delegando ao pyDOE3 (`ff2n`/`fracfact`/`ccdesign`/`bbdesign`/`pbdesign`/`gsd`/`doe_taguchi`/`doe_optimal`) e ao DSD vendorado. Responsável por: codificação natural↔±1, randomização de RunOrder, Point Type/Blocks/Replicates, validação de configuração (guardas D-family), aliasing report. *(depende do domínio)*
- **AnalysisService**: ajuste OLS (statsmodels), ANOVA (anova_lm typ=2), efeitos, coeficientes (codificado+natural), VIF, R²/R²aj/R²previsto (PRESS), Lack-of-Fit. **Guard de estimabilidade (`matrix_rank`) obrigatório antes de reportar.** *(depende de Run/Response)*
- **StatsService**: PRESS/Predicted R², Lenth PSE (saturado), resíduos, Cook/leverage, covariância, Yates (cross-check). *(usado pelo AnalysisService)*
- **PlotService**: gera os dados dos 13 gráficos. Dois modos: JSON Plotly (browser) e render matplotlib+SciencePlots (export: 2D vetor, 3D raster 600 DPI). Grids de superfície/contorno calculados aqui. *(depende do AnalysisService)*
- **ExportService**: XlsxWriter (Excel multi-aba), CSV PT-BR, e orquestra Playwright para renderizar a rota `/report` → PDF. *(depende de Plot+Analysis)*

**Endpoints (routers):** `/experiments` (CRUD), `/designs/generate`, `/experiments/{id}/runs` (+responses), `/analysis`, `/export`. Contratos: request/response Pydantic; análise devolve tabelas + flags de estimabilidade + dados de gráfico prontos.

**Módulos frontend (a criar):** camada `api` (fetch tipado), `hooks` de domínio (useExperiment/useDesign/useAnalysis via TanStack Query), containers (`Dashboard`, `ExperimentSetup` wizard, `RunsTable`, `Analysis`, rota `/report`), componentes presentational (FactorForm, DesignPicker, RunsGrid, AnovaTable, PlotCard, Profiler). Plotly via `dynamic(..., {ssr:false})`. Estado de UI (step do wizard) via Zustand; estado de servidor via TanStack Query.

**Dependências grosseiras (para o to-issues ordenar):** Domínio/DB → DesignService → (CRUD experimento + Data entry) → AnalysisService/StatsService → PlotService → ExportService. Frontend espelha: setup → runs → analysis → report. O golden test do AnalysisService pode ser feito assim que o domínio + um design 2² existirem (não espera o resto).

## Novas adoções (ferramentas / libs / stack)
- **pyDOE3 1.6.2** — lib única de geração (clássico + Taguchi `doe_taguchi` + D/I-optimal `doe_optimal`). Ganhou por cobrir tudo em 1 pacote BSD-3, só numpy+scipy, offline-friendly. **Verificado empiricamente** (instalado e rodado). Fonte: pypi.org/project/pyDOE3, github.com/relf/pyDOE3.
- **definitive-screening-design 0.5.0** — DSD categórico (Jones-Nachtsheim 2013). Ganhou por ser a única implementação verificada (correlação 0 exata). **Vendorar `design.py`** (bus-factor). BSD-3. Fonte: github.com/danieleongari/definitive_screening_design.
- **statsmodels** — motor de ANOVA/OLS/RSM. Ganhou por reproduzir OriginPro/JMP (validado 5 casas). BSD-3.
- **matplotlib + SciencePlots** — export de publicação server-side (2D vetor, 3D raster 600 DPI, estilos science/ieee/nature). Ganhou por qualidade de journal. MIT.
- **Plotly.js / react-plotly.js** — gráficos interativos no browser (surface 3D, contour, profiler). Ganhou por ser o único com 3D interativo web nativo. MIT.
- **Playwright** — PDF via Chromium headless renderizando `/report`. Ganhou por 1 comando no Windows, sem Pango/GTK, e renderiza Plotly ao vivo. Apache-2.0.
- **XlsxWriter** — Excel multi-aba. BSD-2.
- **pyoptex 1.2.1** — SÓ se split-plot for confirmado (hard-to-change). Fora do v1 por padrão (deps pesadas). Fonte: github.com/mborn1/pyoptex.

## Decisões de teste
- **Bom teste aqui** = comportamento externo (números de saída, matriz gerada, flags), nunca detalhe interno.
- **Seam primário (correção matemática)**: o **service layer** (`DesignService`, `AnalysisService`, `StatsService`, `PlotService`) com **golden tests** contra números conhecidos (aula + Montgomery + pyDOE3 golden matrices). É o seam mais alto para o risco #1 (cálculo errado).
- **Seam de fluxo**: os **endpoints FastAPI** via `TestClient` — teste de integração do fluxo ponta a ponta (CA6).
- **Seam visual**: **Playwright/qa-frontend** nas 5 telas (CA9).
- **Cross-checks**: duas implementações de efeitos (OLS + Yates) devem concordar; property test (ΣSS efeitos + SSE == SST); invariância de coding (qualitativo texto vs ±1). Seed e locale decimal fixos no CI.
- Prior art: nenhum (greenfield) — estabelecer o baseline de golden tests.

## Fora de escopo
- **Fase 2** (após primeiro teste): otimização Bayesiana / design adaptativo (baybe/BoFire); designs split-plot (pyoptex) se "tipo de fibra" for hard-to-change; formas clássicas puras 3-níveis de Taguchi (L18(2^1 3^7)/L27(3^13)) se necessárias.
- **Fora (horizonte atual)**: multi-tenant/auth/nuvem; análise de sensibilidade Sobol/Morris; designs de mistura; superfície 3D em vetor puro (usar raster 600 DPI).

## Riscos e questões em aberto
- **R1**: `pyDOE3 1.6.2` em soft-deprecation (README aponta migração futura). Mitigação: pinar exato + golden-matrix tests + a lib é estável/BSD-3.
- **R2**: guard de rank silencioso — statsmodels não retorna NaN em design singular. Mitigação: guard explícito de `matrix_rank` (CA4). É o maior risco de "número plausível porém errado".
- **R3**: `definitive-screening-design` dormante, mantenedor único. Mitigação: vendorar `design.py`.
- **R4**: superfície 3D não sai vetor limpo → raster 600 DPI (decisão aceita).
- **Q1 (aberta, default reversível)**: Taguchi precisa das formas clássicas puras 3-níveis? Default: usar catálogo embutido do pyDOE3.
- ~~**Q2**~~ **RESOLVIDA (Gate 2)**: "tipo de fibra" NÃO é hard-to-change → exchange leve do pyDOE3, sem split-plot. pyoptex fica fora do v1.

## Notas
- O golden test já foi validado num spike (statsmodels == OriginPro em 5 casas) — vira teste automatizado logo no início, servindo de "trilho" para todo refactor do motor.
- A UX de setup deve espelhar (e melhorar) o fluxo do OriginPro documentado em `reference-outputs.md` (dialogs Factorial Design → Settings → Analyze).
- Padrão visual: dark mode científico (ver skill `frontend-react`).

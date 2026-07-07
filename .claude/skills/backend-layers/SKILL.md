---
name: backend-layers
description: 'Convenção de backend do DoE_programa. Use ANTES de mexer em qualquer rota, serviço ou cálculo de DoE aqui. Especializa a convenção global para Python FastAPI + scipy. Casos-gatilho: "endpoint", "cálculo", "ANOVA", "regressão", "gerar matriz", "salvar experimento".'
version: 0.1.0
---

# backend-layers — DoE_programa

Segue a convenção global `agent-driven-protocol:backend-layers` na variante **python-fastapi**. Leia a global pro "como" (camadas router→controller→service→repository, portas/DI, arquivo < 500 linhas). Especializações deste projeto abaixo.

## Stack fixo
Python 3.12 + FastAPI + SQLAlchemy (async) + SQLite (dev) / PostgreSQL (prod) + numpy + scipy + statsmodels + **pyDOE3 1.6.2** (geração: clássico + Taguchi + D/I-optimal) + **definitive-screening-design 0.5.0** (vendorada, DSD) + matplotlib + SciencePlots + pandas + XlsxWriter. Variante: `references/python-fastapi.md`.
⚠️ NÃO usar pyDOE2/pydoe (sem Taguchi). `pingouin` só validação opcional (GPL-3.0). Ver `docs/adp/design-libs-decision.md` e `research-findings.md`.

## Estrutura deste projeto
```
backend/
  main.py               ← entrypoint FastAPI, monta routers
  routers/
    experiments.py      ← CRUD de experimentos
    designs.py          ← geração de matrizes (2^k, fracionado, CCD, BB)
    analysis.py         ← ANOVA, regressão, R², gráficos data
  services/
    design_service.py   ← lógica de geração de matrizes DoE
    analysis_service.py ← ANOVA, RSM, ajuste de modelos
    stats_service.py    ← variância, covariância, R², resíduos
  repositories/
    experiment_repo.py  ← SQLAlchemy queries
  domain/
    models.py           ← SQLAlchemy models (Experiment, Factor, Run, Response)
    schemas.py          ← Pydantic schemas (request/response)
    types.py            ← enums (DesignType, FactorType)
  db.py                 ← engine + session
  requirements.txt
```

## Domínio — entidades e termos
- `Experiment`: projeto DoE (nome, modelo, data criação)
- `Factor`: variável de entrada (nome, tipo, níveis min/max ou categorias)
- `Run`: linha da matriz experimental (combinação de níveis)
- `Response`: variável de saída medida (nome, unidade, valores por run)
- `DesignMatrix`: matriz gerada (colunas codificadas -1/+1 ou naturais)
- `AnalysisResult`: ANOVA table, R², coeficientes, valores p

## Erros de domínio
- `DesignConfigError`: configuração inválida (ex: CCD sem ponto central)
- `InsufficientDataError`: menos réplicas do que o mínimo para o modelo
- `SingularMatrixError`: matriz de informação singular (multicolinearidade)

## Decisões fixas (ADRs — detalhe em docs/adp/CONTEXT.md)
- Cálculos SEMPRE no service layer, NUNCA no router
- `pydoe` (ff2n/fracfact/ccdesign/bbdesign) para geração; `statsmodels` (ols + anova_lm typ=2) para ANOVA/RSM; `scipy.stats` para testes de normalidade
- **Guard de estimabilidade obrigatório** (`np.linalg.matrix_rank(X)` vs n_params) antes de reportar — OLS não retorna NaN em design singular (ADR-007)
- Codificação ±1 explícita, não patsy Sum coding (footgun de sinal — ADR-005)
- Dados de resposta vêm do frontend como JSON array, validados com Pydantic
- Coordenadas para Plotly (surface data) geradas no backend e servidas prontas; export de publicação via matplotlib+SciencePlots (2D vetor, 3D raster 600 DPI)
- PDF via Playwright renderizando rota `/report` do Next.js (ADR-009)
- Banco: SQLite via `doe.db` em dev; arquivo não commitado
- Golden test: reproduzir `docs/adp/reference-outputs.md` (validado vs OriginPro)

## Comandos
Rodar: `cd backend && uvicorn main:app --reload --port 8000`
Testar: `cd backend && pytest -v`
Lint: `cd backend && ruff check .`

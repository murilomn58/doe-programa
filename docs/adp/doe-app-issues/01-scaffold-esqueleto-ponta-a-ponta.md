---
slug: doe-app
issue: 01
title: Scaffold + esqueleto ponta a ponta
status: done
blocked_by: nenhuma
qa: VERDE (2026-07-07) — pytest 4/4, build+lint+typecheck+ruff verdes, E2E navegador (qa-frontend) PASS, migration Alembic confirmada. Commits bee1778, c9f7ca4, 49dd49c.
notas: Next.js 15.5.20 pinado; Python 3.11.9 (env sem 3.12); CORS configurável via CORS_ORIGINS (default 3000) por colisão de porta local.
---

## Pai
PRD: `docs/adp/doe-app-prd.md`

## O que construir
O esqueleto vertical mais fino que já funciona ponta a ponta: um monorepo com `backend/` (FastAPI) e `frontend/` (Next.js 15), banco SQLite via SQLAlchemy com migrations Alembic, e UM caminho end-to-end demoável — criar um experimento (só nome + descrição) pela Dashboard, persistir no banco e listar os experimentos salvos. Estabelece e conecta todas as camadas (router→controller→service→repository e api→hook→container→presentational) e o CORS dev (3000↔8000). Sem lógica de DoE ainda.

## Camadas tocadas
- Backend: `router (/experiments)` → `controller` → `ExperimentService` → `ExperimentRepository` → models `Experiment` + `db` + Alembic
- Frontend: `api` → `hook (useExperiments)` → `container (Dashboard)` → `presentational (ExperimentList, NewExperimentForm)`

## Novas adoções
Stack base: Next.js 15 + TypeScript + Tailwind + TanStack Query (frontend); Python 3.12 + FastAPI + SQLAlchemy + Alembic + SQLite (backend). Ver `docs/adp/CONTEXT.md`.

## Critérios de aceitação
- [ ] `uvicorn` sobe o backend na porta 8000 e `npm run dev` sobe o frontend na 3000
- [ ] POST /experiments cria e persiste; GET /experiments lista; ambos com schema Pydantic
- [ ] Dashboard cria um experimento e mostra na lista (CA6 parcial — fluxo básico)
- [ ] Tudo persiste localmente e funciona offline (CA10 parcial)
- [ ] Migration Alembic inicial cria o schema; `doe.db` no .gitignore
- [ ] Lint/typecheck verdes em ambos os lados

## User stories cobertas
1, 2, 3 (parcial — sem excluir/editar ainda), 5

## Blocked by
Nenhuma — pode começar já.

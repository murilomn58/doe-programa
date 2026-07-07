---
name: tech-lead
description: 'Executor de issues do DoE_programa. Use para implementar as issues em ordem aqui. Especializa o executor global tech-lead do ADP com o stack e as convenções deste projeto. Casos-gatilho: "executa as issues", "implementa a feature", "roda o backlog".'
version: 0.1.0
---

# tech-lead — DoE_programa

Segue o executor global `agent-driven-protocol:tech-lead` (executa as issues em ordem de dependência, um subagente por issue, TDD, convenção antes de codar, reclassifica blocked→runnable, escala quando trava). Especializações deste projeto:

## Convenções deste projeto (abrir ANTES de codar)
- Backend → skill `backend-layers` (variante `python-fastapi`).
- Frontend/UI → skill `frontend-react` (variante `next`).

## Comandos
- Rodar backend: `cd backend && uvicorn main:app --reload --port 8000`
- Rodar frontend: `cd frontend && npm run dev`
- Testar backend: `cd backend && pytest -v`
- Testar frontend: `cd frontend && npm test`
- Convenção de commit: conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`)

## Decisões fixas / ADRs deste projeto
- Monorepo com duas pastas raiz: `backend/` (Python) e `frontend/` (Next.js)
- API backend na porta 8000; frontend na porta 3000
- CORS configurado no FastAPI para `localhost:3000` em dev
- Matrizes DoE geradas 100% no backend; frontend só renderiza
- Plotly.js importado dinamicamente (sem SSR) para evitar erro de `window`
- SQLite `doe.db` não vai pro git; schema gerenciado via Alembic migrations

## Onde ficam as issues
`docs/adp/<slug>-issues/` — executa da `01` pra cima, sem reordenar. Entrega cada fatia verde para o `qa`.

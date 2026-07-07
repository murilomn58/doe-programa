---
name: qa
description: 'Portão de QA do DoE_programa. Use antes de qualquer commit/PR aqui. Especializa o portão global qa do ADP com os comandos e critérios deste projeto. Casos-gatilho: "verifica", "roda o qa", "testa", "revisa antes do commit".'
version: 0.1.0
---

# qa — DoE_programa

Segue o portão global `agent-driven-protocol:qa` (verdade objetiva → histórias nos seams → code review em 2 eixos Standards+Spec → verificação visual → veredito verde/vermelho). Especializações deste projeto:

## Comandos da verdade objetiva (roda a suite COMPLETA)
- Lint backend: `cd backend && ruff check .`
- Typecheck frontend: `cd frontend && npm run typecheck`
- Testes backend: `cd backend && pytest -v`
- Testes frontend: `cd frontend && npm test`
- Build frontend: `cd frontend && npm run build`

## Seams deste projeto
- `backend/tests/` — testes unitários de services (design_service, analysis_service, stats_service)
- `backend/tests/integration/` — testes de endpoint (FastAPI TestClient)
- `frontend/src/__tests__/` — testes de componentes críticos (hooks, containers)
- Visual: verificação manual das telas no browser (porta 3000)

## Padrões documentados (eixo Standards)
- `CLAUDE.md` (este projeto) + skills `backend-layers` e `frontend-react` deste projeto
- Smell baseline global do ADP
- Todos os cálculos DoE devem ter testes com valores conhecidos (ex: fatorial 2^3 validado contra tabela da aula)

## Bloqueante vs não-bloqueante
Bloqueante: build/teste vermelho, matriz DoE errada (valores diferentes do esperado), gráfico Plotly sem renderizar, critério de aceitação ausente.
Não-bloqueante: warning de lint, falta de teste de edge case secundário.
Tem UI a verificar visualmente? **SIM** — dispara o agente `qa-frontend` para screenshots das 5 telas principais.

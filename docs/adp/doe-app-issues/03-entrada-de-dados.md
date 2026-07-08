---
slug: doe-app
issue: 03
title: Entrada de dados (respostas dos ensaios)
status: done
blocked_by: 02
qa: VERDE (2026-07-07) — pytest 31/31 (15 novos: RunService seam + integração), build+lint+typecheck verdes, fluxo ao vivo (colar do Excel, salvamento parcial, decimal PT-BR, validação 422) + QA visual PASS. Commits ad89242, a8043f7 (merged em master).
notas: Run.response_values (JSON) para entrada parcial. parse_response_value aceita vírgula PT-BR. Grade com inputs nativos (sem tanstack/react-table, não adotado).
---

## Pai
PRD: `docs/adp/doe-app-prd.md`

## O que construir
Transformar a RunsTable em uma planilha editável onde o usuário preenche as respostas (Y) de cada ensaio. Edição inline por célula, navegação por teclado (Tab/Enter/setas), colar dados de uma planilha externa (Excel) numa seleção, salvamento (inclusive parcial) e validação de entrada (número válido, aviso de célula vazia). As respostas persistem por run e por variável de resposta.

## Camadas tocadas
- Backend: `router (/experiments/{id}/runs, /responses)` → `controller` → `ExperimentService` → `RunRepository` (bulk upsert de Response)
- Frontend: `api` → `hook (useRuns)` → `container (RunsTable)` → `presentational (RunsGrid editável)` (TanStack Table + edição de célula)

## Novas adoções
Nenhuma.

## Critérios de aceitação
- [ ] Editar respostas inline e salvar; recarregar mostra os valores salvos
- [ ] Navegação por teclado entre células (Tab/Enter/setas)
- [ ] Colar bloco do Excel preenche múltiplas células
- [ ] Salvamento parcial (respostas incompletas) persiste
- [ ] Validação: rejeita não-número, avisa célula vazia
- [ ] Suporta múltiplas variáveis de resposta (ex: MR e DP)

## User stories cobertas
19, 20, 21, 22, 23

## Blocked by
02

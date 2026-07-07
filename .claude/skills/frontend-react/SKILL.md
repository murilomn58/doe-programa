---
name: frontend-react
description: 'Convenção de frontend do DoE_programa. Use ANTES de mexer em qualquer componente, hook, tela, gráfico ou formulário aqui. Especializa a convenção global do ADP para Next.js 15 + Plotly.js. Casos-gatilho: "componente", "tela", "gráfico", "formulário", "input de fatores", "tabela de ensaios".'
version: 0.1.0
---

# frontend-react — DoE_programa

Segue a convenção global `agent-driven-protocol:frontend-react` na variante **next**. Leia a global pro "como" (api→hook→container→presentational, estado de servidor via TanStack Query nunca em useState, mutations com invalidateQueries, verificação visual Playwright). Especializações deste projeto abaixo.

## Stack fixo
Next.js 15 + TypeScript strict + Tailwind CSS 4 + Plotly.js + TanStack Query v5. Variante na global: `references/next.md`.

## Estrutura deste projeto
```
frontend/
  src/
    api/          ← chamadas ao backend FastAPI (fetch tipado)
    hooks/        ← hooks de domínio (useExperiment, useFactors, useResults)
    containers/   ← páginas e fluxos (ExperimentSetup, DataEntry, Analysis)
    components/   ← presentational puros (FactorForm, RunsTable, PlotCard)
    domain/       ← tipos TypeScript do domínio DoE
    lib/          ← utilidades (plotly-config, formatters)
```

## Telas principais
1. **Home / Dashboard** — lista de projetos/experimentos salvos
2. **Novo Experimento** — escolha do modelo (2^k, fracionado, CCD, Box-Behnken), definição de fatores e níveis
3. **Tabela de Ensaios** — matriz gerada, edição de respostas (UX de planilha inline)
4. **Análise** — outputs: ANOVA, R², efeitos, gráficos 2D/3D Plotly interativos
5. **Relatório** — exportação PDF/PNG dos gráficos e tabelas

## Padrão visual
- Dark mode científico: fundo `slate-900`, cards `slate-800`, acentos `blue-500`/`cyan-400`
- Gráficos Plotly com tema `plotly_dark` + paleta de cores coerente com o Tailwind
- Tipografia: Inter (dados numéricos) + JetBrains Mono (valores de tabela/matriz)
- Responsivo: desktop-first (1280px), mas funcional em tablet (768px)

## Decisões fixas
- Plotly.js dinâmico (import client-side via `dynamic(() => import('react-plotly.js'), {ssr: false})`)
- Estado dos experimentos: TanStack Query (servidor) + Zustand (estado local de UI como step atual)
- Formulários: React Hook Form + Zod para validação
- Tabela de ensaios editável: TanStack Table com células editáveis inline

## Verificação visual
Subir: `cd frontend && npm run dev` (porta 3000). Breakpoints: 1280 desktop, 768 tablet.

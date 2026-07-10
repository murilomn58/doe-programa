# NOTES — design-sync do doe-design-system

- Este pacote é um **snapshot decoplado** do frontend Next.js do DoE Programa. A fonte de verdade do app é `frontend/src/components`; as cópias aqui trocam classes de cor Tailwind por tokens semânticos (`src/tokens.css`). O app NÃO consome este pacote (port-back é fase 2 do PRD `docs/adp/design-system-sync-prd.md`).
- Fonte Inter carregada via `@import` do Google Fonts em `src/styles.css` → `[FONT_REMOTE]` é esperado e OK.
- Plotly ficou **de fora do bundle de propósito** (peso; o agente de design não redesenha o interior dos gráficos). A moldura `PlotCard` entra; previews usam um placeholder no slot do gráfico.
- Previews usam dados do domínio real (aula de DoE: fatores "% Fibra" e "% Cimento", resposta "Módulo de Resiliência (MPa)"; ver `docs/adp/reference-outputs.md`).
- Build: `npm run build` = tsc (dist/*.js + .d.ts) + tailwind CLI (`dist/styles.css`). O `@source` em styles.css inclui `./components` e `.design-sync/previews` para as classes usadas entrarem no CSS.
- Tokens `--color-accent-deep` (cyan-600) e `--color-primary-strong` (blue-600) existem em tokens.css mas sofrem tree-shake (nenhum componente os usa) → não aparecem no `dist/styles.css`. Não citados como classes no conventions header. Se um componente passar a usá-los, reaparecem.
- `cardMode: column` aplicado (em `cfg.overrides`) a AliasingReport, AnovaTable, DesignPicker, EffectsTable, FactorPairSelector, ResponsesForm — eram largos demais para a célula do grid (GRID_OVERFLOW). Resolvido.

## Known render warns (esperados — não são novos)
- `[FONT_REMOTE] "Inter"` — a fonte vem por `@import` do Google Fonts; carrega em runtime. Esperado, não bloqueante.

## Re-sync risks
- As cópias em `src/components/` são **snapshot manual** do frontend. Se `frontend/src/components/*` mudar, este pacote NÃO acompanha sozinho — re-extrair os componentes afetados e re-aplicar o mapa de tokens.
- Previews usam dados fixos da aula (reference-outputs.md); não quebram com mudança de código, mas podem ficar desatualizadas se a API de props de um componente mudar.
- O grading (71/71 good) foi feito por subagentes lendo os sheets; spot-check humano/orquestrador cobriu DesignPicker, FactorPairSelector e o contact sheet. Um bump grande de tokens pede re-captura + regrade.

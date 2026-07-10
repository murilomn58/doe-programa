# NOTES — design-sync do doe-design-system

- Este pacote é um **snapshot decoplado** do frontend Next.js do DoE Programa. A fonte de verdade do app é `frontend/src/components`; as cópias aqui trocam classes de cor Tailwind por tokens semânticos (`src/tokens.css`). O app NÃO consome este pacote (port-back é fase 2 do PRD `docs/adp/design-system-sync-prd.md`).
- Fonte Inter carregada via `@import` do Google Fonts em `src/styles.css` → `[FONT_REMOTE]` é esperado e OK.
- Plotly ficou **de fora do bundle de propósito** (peso; o agente de design não redesenha o interior dos gráficos). A moldura `PlotCard` entra; previews usam um placeholder no slot do gráfico.
- Previews usam dados do domínio real (aula de DoE: fatores "% Fibra" e "% Cimento", resposta "Módulo de Resiliência (MPa)"; ver `docs/adp/reference-outputs.md`).
- Build: `npm run build` = tsc (dist/*.js + .d.ts) + tailwind CLI (`dist/styles.css`). O `@source` em styles.css inclui `.design-sync/previews` para as classes-glue das previews entrarem no CSS.

# Handoff — redesenho na claude.ai/design → port de volta

## Estado (2026-07-10)
Pacote `design-system/` pronto e sincronizável. 16 componentes decoplados, tokens semânticos, 16 previews (71/71 cells graded **good**), build tsc+tailwind verde, converter `package-validate` → `✓ bundle is complete` (16/16 render limpos).

**Único bloqueio para publicar:** o `/login` precisa entrar com **"Claude account with subscription"** (a conta com acesso ao claude.ai/design). Enquanto os design scopes não entram, o `ds-bundle/` já está montado localmente e o upload é imediato quando o login resolver.

## Passo 1 — publicar o design system (eu faço)
Quando o login estiver ok, eu executo: criar projeto → aprovar upload (1 clique) → subir os 16 componentes + tokens + guidelines. Você recebe a **URL** `https://claude.ai/design/p/<id>`.

## Passo 2 — redesenhar (você faz, na plataforma)
Na claude.ai/design, abra o projeto e prompte o agente de design. Ele já conhece:
- **Seus 16 componentes reais** (compõe telas com eles, não com genéricos).
- As **regras de redesenho** (guidelines/README): tokens semânticos, significância estatística (p<0.05), densidade científica, PT-BR.

Sugestões de prompt:
- *"Redesenhe a tela de Análise usando estes componentes; proponha uma paleta nova mantendo o token `significant` distinto do `accent`."*
- *"Mostre 3 variações de paleta para as tabelas científicas (ANOVA, efeitos, coeficientes)."*
- *"Reimagine o wizard de Setup (fatores → respostas → DesignPicker) com formas e espaçamento mais modernos."*

**Referência das telas inteiras** (para o agente entender o contexto real) — screenshots do QA em `docs/adp/fase-final-qa/`:
| Tela | Arquivo |
|---|---|
| Dashboard | `2026-07-08-dashboard-desktop.png` |
| Setup / DesignPicker (8 famílias) | `2026-07-09-designpicker-8familias-desktop.png` |
| Análise (tela densa) | `2026-07-08-analysis-fullpage-desktop.png` |
| Relatório PDF (tema claro) | `2026-07-08-report-18-fullpage-desktop.png` |
| Retrospectiva | `2026-07-09-retrospectiva-card-2x3.png` |
Anexe esses PNGs no prompt quando quiser redesenhar uma tela específica.

## Passo 3 — devolver para o port (você → eu)
Quando fechar o redesenho, me passe **o que mudou**, em qualquer destes formatos:
1. **Melhor caminho:** os novos valores de token (as cores/raios/spacing que o agente definiu) — como o app inteiro lê de tokens, trocar a paleta é quase só reescrever `tokens.css`.
2. Link/print das telas redesenhadas + notas do que mudou por componente.
3. O código que o agente gerou (se exportar).

## Passo 4 — port de volta (eu faço)
Eu aplico o redesenho no app Next.js real (`frontend/`), **sem mudar funcionalidade e sem tocar no backend**:
- Redefino a camada de tokens no `frontend/src/app/globals.css` (hoje o app usa classes slate/cyan/emerald soltas; parte do port é justamente introduzir os tokens semânticos no app, espelhando o que fizemos no pacote).
- Ajusto os componentes conforme o redesenho.
- Rerodo o QA completo: `npm run typecheck`, `npm run lint`, `npm run build` + verificação visual (Playwright) contra os critérios.
- Abro PR para sua revisão (gate humano do ADP — nada entra no `main` sem sua revisão).

## Revisão local opcional (agora)
O bundle traz `design-system/ds-bundle/.review.html` — uma página que renderiza todos os cards. Para abrir:
```
cd design-system && node .ds-sync/storybook/http-serve.mjs ./ds-bundle
```
e abra a URL que ele imprime (`.review.html`). Se algo parecer errado em algum card, me diz que eu ajusto antes de subir.

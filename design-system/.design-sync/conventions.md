# DoE Programa — Design System

Componentes presentational de um app científico de **Planejamento de Experimentos (DoE)** em português (Brasil). Tema **escuro** por padrão. Público técnico/acadêmico, alta densidade de informação. Todos os componentes importam de `doe-design-system` (`window.DoeDS.*`).

## Setup e estilo
Não há provider nem wrapper obrigatório — cada componente renderiza sozinho desde que a folha de estilo esteja carregada. Importe `styles.css` uma vez na raiz: ela traz o Tailwind, os tokens (`tokens/`) e o CSS compilado dos componentes (`_ds_bundle.css`). Sem essa folha, os componentes saem sem estilo (texto preto em fundo branco).

A fonte é **Inter** (carregada por `@import` remoto no `styles.css`). Números de tabelas científicas usam `font-mono` (tabular) — mantenha isso em qualquer redesenho de tabela.

## Idioma dos tokens (o vocabulário do redesenho)
Este DS **não usa cores cruas do Tailwind** — toda cor é um token semântico CSS. Para redesenhar a identidade, redefina os tokens em `tokens/` (nunca hardcode `slate-800`, `cyan-500`, etc.). As classes utilitárias seguem o nome do token:

| Família | Classes (exemplos) | Papel |
|---|---|---|
| Superfícies | `bg-surface-0` · `bg-surface-1` · `bg-surface-2` · `bg-surface-3` | fundo da página → cards → controles → realce |
| Bordas | `border-border-subtle` · `border-border` · `border-border-strong` | divisórias → borda de card → borda de controle |
| Texto | `text-foreground-strong` · `text-foreground` · `text-foreground-soft` · `text-muted` · `text-faint` | título → corpo → secundário → rótulo → hint |
| Acento (dados/interação) | `text-accent` · `bg-accent-strong` · `border-accent-strong` · `accent-mid` · `border-accent-border` | destaque de dados, links, foco em telas de análise (cyan) |
| Ação primária (forms) | `bg-primary` · `text-primary-soft` · `border-primary` | botões/inputs de formulário (azul); `text-on-primary` para texto sobre `bg-primary` |
| **Significância** (domínio) | `text-significant` · `significant-soft` · `bg-significant-strong` · `border-significant-border` | **p < 0.05** em tabelas estatísticas — SEMPRE distinguível do acento |
| Aviso | `text-warning` · `warning-soft` · `bg-warning-strong` · `bg-warning-surface` · `border-warning-border` | avisos de estimabilidade/confundimento (âmbar) |
| Erro | `text-danger` · `danger-soft` · `bg-danger-strong` · `bg-danger-surface` · `border-danger-border` | design singular/erro (vermelho) |
| Info | `bg-info` · `text-info-soft` | categoria especial/informativa (violeta) |
| Sobre-cor | `text-on-accent` · `text-on-primary` | texto legível sobre botões coloridos |

Regra de ouro do domínio: **`significant` é semântico** (efeito estatisticamente significativo, p < 0.05). Em qualquer paleta nova ele precisa continuar visualmente distinto do `accent` — não colapse os dois na mesma cor.

## Onde está a verdade
Antes de estilizar, leia `styles.css` e seus `@import` (tokens + `_ds_bundle.css`) para os valores reais, e `components/<Grupo>/<Nome>/<Nome>.prompt.md` para a API de cada componente. As tabelas científicas (`AnovaTable`, `EffectsTable`, `CoefTable`, `StatsPanel`) esperam números alinhados à direita em `font-mono`, cabeçalhos discretos (`text-muted`, `uppercase`, `tracking-wide`) e boa leitura em densidade alta.

O `PlotCard` é a **moldura** de um gráfico — no app real o miolo é renderizado por Plotly. Trate o slot interno como uma área retangular de conteúdo; redesenhe título, hint e menu de export, não o interior do gráfico.

## Exemplo idiomático
```tsx
import { AnovaTable } from "doe-design-system";

// glue de layout com tokens; dados vêm do backend
<section className="bg-surface-0 p-6 text-foreground">
  <AnovaTable
    rows={anovaRows}          // p < 0.05 destacado em `text-significant`
    rSquared={0.86692}
    adjRSquared={0.81369}
    /* ...demais props em AnovaTable.prompt.md */
  />
</section>
```

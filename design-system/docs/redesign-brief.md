# DoE Programa — guia de redesenho

## O que é o produto
Aplicativo científico de **Planejamento de Experimentos (DoE)** para engenharia (misturas com fibra, solos, pavimentos). O usuário define fatores e níveis, escolhe uma família de design (fatorial 2^k, fracionado, CCD, Box-Behnken, Taguchi, Plackett-Burman, D-optimal, DSD), preenche os ensaios e recebe análise estatística completa (ANOVA, efeitos, regressão, superfícies de resposta, diagnósticos, profiler de desirability) com export de figuras em qualidade de publicação e relatório PDF.

## Telas do app (referência: screenshots do QA)
1. **Dashboard** — lista de experimentos + card de análise retrospectiva.
2. **Setup (wizard)** — nome/descrição → fatores (nome, tipo, níveis) → respostas → **DesignPicker** (8 famílias com opções específicas: resolução do fracionado, variantes de CCD com α previsto, catálogo Taguchi L4–L81, etc.).
3. **Entrada de dados** — grade de ensaios (matriz codificada ±1 + colunas de resposta editáveis, colar do Excel).
4. **Análise** — a tela mais densa: tabelas científicas (ANOVA, efeitos, coeficientes), painel de estatísticas, construtor de modelo, gráficos interativos em molduras (`PlotCard`), diagnósticos de resíduos, profiler com desirability, menus de export (PNG 600 DPI/SVG/PDF).
5. **Relatório** — versão impressa em TEMA CLARO (papel A4 branco) do mesmo conteúdo, virando PDF.
6. **Retrospectiva** — colar dados de um experimento já executado e diagnosticar o design ao vivo.

## Identidade visual atual (o ponto de partida)
- **Tema escuro** primário: superfícies slate (900/800/700), texto claro, acento **cyan**, significância estatística **emerald** (p < 0.05 fica verde e semibold nas tabelas).
- Fonte **Inter**; números de tabelas científicas em **monospace** (`font-mono`).
- Cards: `rounded-xl`, borda sutil, `shadow-lg`.
- Densidade de informação alta — o público é técnico/acadêmico.

## Regras para redesenhar
- **Use SOMENTE os tokens semânticos** (definidos em `tokens/` e `styles.css`): `surface-0..3`, `border-subtle/border/border-strong`, `foreground-strong/foreground/foreground-soft/muted/faint`, `accent/accent-mid/accent-strong/accent-deep`, `significant`, `warning`, `danger` (+ variantes `-soft`). Trocar a paleta = redefinir esses tokens, nunca hardcodar cor.
- A cor `significant` é **semântica de domínio** (p < 0.05): precisa continuar distinguível do acento em qualquer paleta nova.
- Tabelas científicas precisam de: números alinhados à direita, monospace, cabeçalhos discretos, e boa leitura em densidade alta.
- O slot de gráfico dentro do `PlotCard` é renderizado por Plotly no app real — trate-o como uma área retangular de conteúdo; redesenhe a moldura (título, hint, menu de export), não o interior.
- Manter acessibilidade: contraste AA no mínimo, estados de foco visíveis, `aria-*` existentes.
- Idioma da UI: **português (Brasil)**, com acentuação correta.

## Objetivo do redesenho
Explorar nova paleta, formas e opções de layout **mantendo a função de cada componente intacta** — o resultado será portado de volta para o app Next.js real trocando a camada de tokens e os estilos, sem mudar comportamento.

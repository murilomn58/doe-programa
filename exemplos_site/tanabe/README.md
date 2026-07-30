# Tanabe: solo-cimento-rejeito em sete blocos

Planejamento pronto, **ainda sem resultado medido**. O experimento não foi
rodado: a matriz existe para ser levada à bancada e preenchida.

## O que foi decidido, e por quê

**Tipo de solo entra como bloco, não como fator.** São sete solos, e um fator
qualitativo na plataforma aceita duas categorias. Mas a razão não é a
limitação: o tipo de solo não é objeto do estudo. A pergunta é sobre teor de
cimento e de rejeito, e o solo é uma fonte de variação conhecida que afeta a
resposta. Tratá-lo como bloco tira essa variação da estimativa de erro, em vez
de deixá-la inflar a dispersão e mascarar o efeito dos teores.

Cada bloco recebe uma repetição completa do arranjo, e a comparação entre os
teores é feita dentro de cada solo. O tratamento está no Caderno 1, seção 9,
com o exemplo dos cinco pares arma-radar: os mesmos dez valores levam a
conclusões opostas conforme se reconheça ou não o bloco.

**Três níveis por fator, não dois.** A pergunta é qual o teor ótimo. Com dois
níveis o experimento só diria se a resposta sobe ou desce dentro da faixa; o
termo quadrático, que é o que localiza um máximo interior, exige um nível
intermediário.

**Fatorial completo 3², e não composto central.** Com dois fatores em três
níveis, o 3² já ensaia todas as nove combinações e estima o modelo quadrático
inteiro. O composto central de face centrada tem a mesma geometria mais
pontos centrais repetidos: custaria dois ensaios a mais por solo, catorze no
total, em troca de graus de liberdade de erro puro. Como já há sete blocos
alimentando o resíduo, o ganho não paga os catorze corpos de prova.

## O arranjo

| | |
|---|---|
| Fatores | Cimento de 0 a 10 % · Rejeito de 0 a 40 % |
| Níveis | 0, 5 e 10 % · 0, 20 e 40 % |
| Blocos | Residual, Laterítico, Saprolítico, Aluvionar, Orgânico, Arenoso, Siltoso |
| Resposta | Módulo de resiliência, em MPa |
| Ensaios | 9 por solo, **63 no total** |
| Ordem | sorteada sobre o conjunto inteiro, com os solos intercalados |

A ordem é sorteada de propósito, e não agrupada por solo. Rodar os sete solos
em sequência confundiria qualquer deriva do laboratório ao longo das semanas
com efeito de solo, que é justamente o que a blocagem existe para separar.

## Arquivos

| Arquivo | O que é |
|---|---|
| `gerar_planejamento.py` | Gera tudo a partir do mesmo motor que a plataforma usa, com semente fixa `20260729`. Confere que cada bloco tem as nove combinações e que os solos saem intercalados; falha se não. |
| `planejamento-tanabe.csv` | Folha de bancada. Vírgula decimal e ponto e vírgula como separador, abre direto no Excel em português. A coluna do módulo fica em branco. |
| `tanabe.dados.json` | Saída intermediária, consumida pelo gerador do exemplo do app. |

O exemplo aparece na plataforma em `/experiments`, no botão "Ver um
planejamento em blocos, pronto para a bancada", e abre na matriz de ensaios.
O código está em `frontend/src/engine/exemploTanabe.ts` e é **gerado**: para
mudar o arranjo, edite o script e rode de novo, não edite as linhas à mão.

## Para regerar

```powershell
cd C:\dev\iacommurilo\DoE_programa\backend
.\.venv\Scripts\python.exe ..\exemplos_site\tanabe\gerar_planejamento.py
```

## Quando os dados chegarem

Preencher a coluna do módulo de resiliência e carregar pela plataforma. A
análise com sete blocos traz uma linha `Bloco (Tipo de solo)` na ANOVA, com
seis graus de liberdade, e os coeficientes de cimento e rejeito já ajustados
por solo. Só então faz sentido falar em gráfico de resultado.

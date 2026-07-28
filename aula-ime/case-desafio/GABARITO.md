# GABARITO — Case de desafio solo-fibra-cimento

> **USO EXCLUSIVO DO PROFESSOR.** Este arquivo contém o modelo que gerou os dados.
> Não distribuir, não projetar e não deixar aberto na máquina da sala.
> O que vai para as equipes é apenas `case-solo-fibra-cimento.csv` (ou o `.xlsx`)
> e o enunciado: *achar o teor de cimento e o teor de fibra que maximizam o fck aos 28 dias*.

Gerado por `gerar_case.py`, determinístico. Rodar o script de novo reproduz exatamente
os mesmos arquivos e os mesmos números abaixo.

---

## 1. Modelo verdadeiro

Em variáveis codificadas `z ∈ [−1, 1]`:

```
fck = 2,95 + 0,86·z₁ + 0,34·z₂ − 0,52·z₁² − 0,61·z₂² − 0,23·z₁·z₂
```

| | `z = −1` | `z = 0` | `z = +1` | axial `z = ±√2` |
|---|---|---|---|---|
| `z₁` = cimento (% em massa) | 4,00 | 6,00 | 8,00 | 3,17 e 8,83 |
| `z₂` = fibra (% em massa) | 0,50 | 1,00 | 1,50 | 0,29 e 1,71 |

Conversão: `z₁ = (cimento − 6)/2` e `z₂ = (fibra − 1)/0,5`.

Região experimental declarada: cimento de 3 a 9 %, fibra de 0,25 a 1,75 %.
Os níveis fatoriais ficam dentro dessa faixa e os pontos axiais chegam perto das bordas,
de modo que nenhum ensaio exija dosagem fisicamente impossível.

**Design:** composição central rotacionável de dois fatores — 4 pontos fatoriais,
4 axiais com `α = √2`, 3 centrais, 11 ensaios.
**Ruído:** gaussiano, `σ = 0,08` MPa, semente `numpy.random.default_rng(20260728)`.
**Arredondamento:** `fck` gravado com 2 casas decimais.

Os dois termos quadráticos negativos garantem concavidade; a interação desloca o ótimo
para longe do centro, de modo que "o ponto central" **não** seja a resposta certa.

## 2. Dados entregues, com a resposta sem ruído ao lado

| Ensaio | Tipo | Cimento % | Fibra % | `z₁` | `z₂` | fck sem ruído | **fck entregue** |
|---|---|---|---|---|---|---|---|
| 1 | fatorial | 4,00 | 0,50 | −1,0000 | −1,0000 | 0,3900 | **0,54** |
| 2 | fatorial | 4,00 | 1,50 | −1,0000 | +1,0000 | 1,5300 | **1,54** |
| 3 | fatorial | 8,00 | 0,50 | +1,0000 | −1,0000 | 2,5700 | **2,56** |
| 4 | fatorial | 8,00 | 1,50 | +1,0000 | +1,0000 | 2,7900 | **2,87** |
| 5 | axial | 3,17 | 1,00 | −1,4150 | 0,0000 | 0,6919 | **0,71** |
| 6 | axial | 8,83 | 1,00 | +1,4150 | 0,0000 | 3,1257 | **3,16** |
| 7 | axial | 6,00 | 0,29 | 0,0000 | −1,4200 | 1,2372 | **1,18** |
| 8 | axial | 6,00 | 1,71 | 0,0000 | +1,4200 | 2,2028 | **2,26** |
| 9 | central | 6,00 | 1,00 | 0,0000 | 0,0000 | 2,9500 | **2,85** |
| 10 | central | 6,00 | 1,00 | 0,0000 | 0,0000 | 2,9500 | **2,93** |
| 11 | central | 6,00 | 1,00 | 0,0000 | 0,0000 | 2,9500 | **3,03** |

As coordenadas naturais foram arredondadas a 2 casas antes de avaliar o modelo,
por isso os pontos axiais têm `z = ±1,415` e `±1,420` em vez de `±1,41421`.
O conjunto é internamente consistente: quem converter cimento e fibra para `z`
a partir da tabela entregue reencontra exatamente estes valores.

## 3. Ótimo analítico (verdadeiro)

Resolvendo `∇fck = 0`:

| | codificado | natural |
|---|---|---|
| `z₁*` / cimento | **0,798585** | **7,5972 %** |
| `z₂*` / fibra | **0,128136** | **1,0641 %** |

`fck` no ótimo: **3,315175 MPa**.

Autovalores da matriz de segundas derivadas: `−1,37698` e `−0,88302`.
Ambos negativos, logo é um **máximo** e não um ponto de sela. Ambas as coordenadas
estão dentro de `[−1, 1]`, logo o ótimo é **interior** à região fatorial.

**Resposta arredondada para a sala: cimento ≈ 7,6 % e fibra ≈ 1,06 %.**

## 4. Ótimo recuperado pelo ajuste aos 11 pontos

Ajuste do modelo quadrático completo (`statsmodels` OLS, variáveis codificadas):

| Termo | Ajustado | Verdadeiro | Erro-padrão | `t` | `p` |
|---|---|---|---|---|---|
| intercepto | 2,93680 | 2,95 | 0,04277 | 68,673 | < 0,00001 |
| `z₁` (cimento) | 0,85162 | 0,86 | 0,02618 | 32,528 | < 0,00001 |
| `z₂` (fibra) | 0,35400 | 0,34 | 0,02613 | 13,545 | 0,00004 |
| `z₁²` | −0,48920 | −0,52 | 0,03116 | −15,698 | 0,00002 |
| `z₂²` | −0,59246 | −0,61 | 0,03098 | −19,123 | 0,00001 |
| `z₁·z₂` | −0,17250 | −0,23 | 0,03704 | −4,658 | 0,00554 |

| Grandeza | Valor |
|---|---|
| `R²` | **0,997133** |
| `R²` ajustado | 0,994267 |
| RMSE | 0,074072 MPa |
| GL do resíduo | 5 |

Todos os seis termos são significativos a 1 %, inclusive a interação (`p = 0,0055`).
Uma equipe que remover a interação está removendo um termo real.

**Ótimo recuperado:**

| | codificado | natural | erro |
|---|---|---|---|
| `z₁*` / cimento | 0,839299 | **7,6786 %** | 0,0814 p.p. |
| `z₂*` / fibra | 0,176569 | **1,0883 %** | 0,0242 p.p. |

`fck` **real** entregue por esse ponto: 3,312428 MPa — perda de apenas 0,0027 MPa
em relação ao ótimo verdadeiro.

Autovalores do ajuste: `−1,28270` e `−0,88061`. O ajuste também identifica um máximo.

## 5. Faixa de tolerância a aceitar na premiação

**Aceitar como correta a resposta que satisfaça as duas condições ao mesmo tempo:**

| Fator | Alvo | Faixa aceita |
|---|---|---|
| Cimento | 7,60 % | **7,40 % a 7,80 %** (± 0,20 p.p.) |
| Fibra | 1,06 % | **0,91 % a 1,21 %** (± 0,15 p.p.) |

Por que essa faixa:

| Caminho de análise | Cimento % | Fibra % | Erro cim. | Erro fib. | fck real | Dentro da faixa? |
|---|---|---|---|---|---|---|
| ótimo verdadeiro | 7,5972 | 1,0641 | — | — | 3,3152 | — |
| **quadrático completo** (o esperado) | 7,6786 | 1,0883 | 0,0814 | 0,0242 | 3,3124 | **sim**, com folga |
| quadrático sem a interação | 7,7409 | 1,1494 | 0,1437 | 0,0853 | 3,2919 | **sim** |
| melhor ensaio observado (nº 6, sem ajustar modelo) | 8,8300 | 1,0000 | 1,2328 | 0,0641 | 3,1257 | **não** (cimento) |
| ponto central (chute ingênuo) | 6,0000 | 1,0000 | 1,5972 | 0,0641 | 2,9500 | **não** (cimento) |

A faixa aceita qualquer análise defensável — inclusive a de quem ajustou o modelo sem o
termo de interação — e rejeita quem não ajustou modelo nenhum.

**O cimento é o discriminador.** Na fibra, o ótimo verdadeiro (1,064 %) cai perto do ponto
central (1,00 %), de modo que até um chute acerta a fibra; é o teor de cimento que separa
quem ajustou a superfície de quem apontou o melhor ensaio da tabela.
Na hora de conferir, olhar o cimento primeiro.

**Desempate:** avaliar o modelo verdadeiro no ponto respondido por cada equipe e ordenar
pelo `fck` resultante (coluna "fck real" acima). Vence o maior. Esse critério ordena
sem ambiguidade e premia justamente quem chegou mais perto de maximizar de fato,
que é o que o enunciado pede.

```python
# conferência de uma resposta, em 3 linhas
z1, z2 = (cimento - 6) / 2, (fibra - 1) / 0.5
fck = 2.95 + 0.86*z1 + 0.34*z2 - 0.52*z1**2 - 0.61*z2**2 - 0.23*z1*z2
print(f"{fck:.4f} MPa  (ótimo = 3.3152)")
```

## 6. Verificação dos três critérios de qualidade do case

| # | Critério | Resultado |
|---|---|---|
| 1 | ótimo analítico dentro de `[−1, 1]` nos dois eixos | **atende** — `\|z₁*\| = 0,7986`, `\|z₂*\| = 0,1281`, Hessiana definida negativa |
| 2 | `Δfck` entre o ótimo e o melhor ponto fatorial > `3σ` | **atende** — `Δ = 0,5252` MPa contra `3σ = 0,2400` MPa, margem de **2,19×** |
| 3 | ótimo recuperado a menos de 0,2 % em cada fator | **atende** na leitura em pontos percentuais: 0,0814 p.p. no cimento e 0,0242 p.p. na fibra |

Sobre o critério 2: o melhor ponto do design inteiro é o axial nº 6 (`fck` verdadeiro 3,1257 MPa),
a 0,1894 MPa do ótimo. O critério do plano é comparar com o melhor ponto **fatorial**, e é ele
que passa com folga. A consequência prática está na tabela da seção 5: quem responde o ensaio
nº 6 erra o cimento em 1,23 p.p. e fica fora da faixa.

Sobre o critério 3, a leitura estrita: 0,2 % **relativo** exigiria erro menor que 0,0152 p.p.
no cimento e 0,0021 p.p. na fibra. Esse alvo é inatingível por construção — gravando o `fck`
com 2 casas decimais, só a quantização do arredondamento (± 0,005 MPa) já desloca o ótimo
recuperado nessa ordem de grandeza, mesmo com `σ → 0`. Baixar `σ` a ponto de satisfazê-lo
exigiria um coeficiente de variação abaixo de 0,2 % num ensaio de `fck` de solo-cimento,
o que nenhum aluno acreditaria. A leitura em pontos percentuais é a fisicamente significativa
(os fatores são medidos em por cento) e é a que governa a premiação.

## 7. Como conduzir na sala

1. Distribuir apenas o CSV (ou o XLSX) e o enunciado. Formar equipes de 2 a 3.
2. As equipes precisam perceber que 11 ensaios com 3 réplicas no centro e pontos além
   dos vértices formam uma composição central, e que isso permite estimar termos quadráticos.
3. O caminho esperado: codificar os fatores, ajustar `fck ~ z₁ + z₂ + z₁² + z₂² + z₁z₂`,
   conferir `R²` e a significância dos termos, derivar e resolver `∇fck = 0`,
   checar pelos autovalores que é máximo, converter de volta para % em massa.
4. Quem tentar responder pelo melhor ensaio da tabela vai dizer 8,83 % de cimento e ficar
   de fora — é exatamente a lição do desafio: **o melhor ensaio realizado quase nunca é o
   ponto ótimo**; é preciso a superfície para enxergar entre os pontos.
5. Conferir com o bloco de 3 linhas da seção 5 e premiar pelo maior `fck` real.

---

`© 2026 Murilo Miguel Narciso. Material do professor.`

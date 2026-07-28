# Banco de números conferidos — apostilas e deck

> **Regra de uso.** Nenhum valor numérico entra numa apostila, num slide ou numa figura sem
> estar neste arquivo. Cada conjunto traz a chave (usada nos `.tex` e nos scripts de figura),
> os dados de entrada **completos**, os resultados e a fonte com arquivo e página.
> Valor que não esteja aqui é valor sem procedência: não use.

**Data da conferência:** 28/07/2026
**Motor de referência:** `backend/services/analysis_service.py` (statsmodels OLS + `anova_lm`),
o mesmo código que roda no browser via Pyodide. Auditoria em `docs/adp/auditoria-aulas-2026-07.md`.

**Comandos de reconferência** (devem passar antes de qualquer commit que mexa em número):

```powershell
cd C:\dev\iacommurilo\DoE_programa\backend
.\.venv\Scripts\python.exe -m tests.audit.verify_aulas
.\.venv\Scripts\python.exe -m pytest tests/test_golden_aulas.py tests/test_blocks_curvature.py -q
```

Resultado em 28/07/2026: auditoria numérica com todas as verificações passando; `6 passed` no pytest.
Os 11 conjuntos abaixo foram, além disso, recalculados um a um a partir dos dados brutos
transcritos dos PDFs originais (177 verificações, nenhuma divergência).

**Convenção de sinal.** Codificação `±1` explícita em todos os conjuntos
(nunca *Sum coding* do patsy, que inverte o sinal silenciosamente — ADR-005).
Efeito `E = 2b`, onde `b` é o coeficiente da variável codificada.

**Convenção decimal.** Vírgula decimal no texto das apostilas; ponto neste arquivo,
para os valores poderem ser copiados direto para dentro de código Python.

---

## Índice

| Chave | Conteúdo | Fonte |
|---|---|---|
| [`peixoto-2x2`](#1-peixoto-2x2) | 2² catalisador, 2 réplicas, modelo com interação | Peixoto cap. 3, p. 2–9 |
| [`peixoto-2x3`](#2-peixoto-2x3) | 2³ com 2 réplicas, 8 efeitos | Peixoto cap. 3, p. 18–26 |
| [`peixoto-2a4`](#3-peixoto-2a4) | 2⁴ completo e a meia-fração 2⁴⁻¹ | Peixoto cap. 4, p. 3–17 |
| [`peixoto-saturado`](#4-peixoto-saturado) | 2⁷⁻⁴_III saturado + dobramento | Peixoto cap. 4, p. 36–42 |
| [`peixoto-lin-quad`](#5-peixoto-lin-quad) | linear × quadrático, falta de ajuste e erro puro | Peixoto cap. 5, p. 32–34 |
| [`peixoto-potencia`](#6-peixoto-potencia) | `v = k·Pᵃ` linearizada, 18 pontos | Peixoto cap. 5, p. 21–22 |
| [`origin-2x2`](#7-origin-2x2) | 2² só efeitos principais (relatório OriginPro) | `DOE Analysis.pdf` |
| [`origin-ccd`](#8-origin-ccd) | CCD k=2 em 2 blocos, falta de ajuste | `Doe ANalysis pra superficie d resposta.pdf` |
| [`aula-statistica`](#9-aula-statistica) | 2² com 2 réplicas + interação (painel Statistica) | `reference-outputs.md` |
| [`aula-originpro`](#10-aula-originpro) | mesmos 8 ensaios, só efeitos principais, PRESS | `reference-outputs.md`, linhas 29–38 |
| [`armaradar`](#11-armaradar) | 5 pares, com e sem blocagem | Peixoto cap. 1–2, p. 47–53 |

Caminho dos PDFs: `DoE_programa/contexto aulas/`.

---

## 1. `peixoto-2x2`

**Fonte:** `contexto aulas/prof PEIXOTO/Capítulo 3.pdf`, p. 2–9 (tabela na p. 2; efeitos p. 3 e 5;
erros p. 9; coeficientes p. 16).

Fatorial 2² completo com 2 réplicas por célula. Resposta: rendimento de reação, em %.

**Fatores**

| Símbolo | Fator | Tipo | Nível `−1` | Nível `+1` |
|---|---|---|---|---|
| `x₁` | Temperatura | quantitativo | 313 K | 333 K |
| `x₂` | Catalisador | qualitativo | A | B |

**Dados de entrada (completos)**

| Ensaio | T (K) | Catalisador | `x₁` | `x₂` | Réplica 1 | Réplica 2 | Média | Variância |
|---|---|---|---|---|---|---|---|---|
| 1 | 313 | A | −1 | −1 | 57 | 61 | 59 | 8 |
| 2 | 333 | A | +1 | −1 | 92 | 88 | 90 | 8 |
| 3 | 313 | B | −1 | +1 | 55 | 53 | 54 | 2 |
| 4 | 333 | B | +1 | +1 | 66 | 70 | 68 | 8 |

**Resultados**

| Grandeza | Valor | Observação |
|---|---|---|
| Média global `M` | 67.75 ± 0.9 | erro exato 0.901388 |
| `E_T` | 22.5 ± 1.8 | erro exato 1.802776 |
| `E_C` | −13.5 ± 1.8 | |
| `E_TC` | −8.5 ± 1.8 | |
| `β̂₀` | 67.75 | = média global |
| `β̂₁` (T) | 11.25 | = `E_T`/2 |
| `β̂₂` (Cat) | −6.75 | |
| `β̂₃` (T·Cat) | −4.25 | |
| `S²` combinada | 6.5 | 4 GL, = MQ do erro puro |
| `S` | 2.549510 | |

Modelo ajustado: `ŷ = 67.75 + 11.25·x₁ − 6.75·x₂ − 4.25·x₁x₂`.

> **Errata 1 aplicável aqui.** A p. 3 imprime `E_T = [(90−59) + (68−64)]/2 = 22,5`.
> O `64` está errado: o valor correto é `54` (a média do ensaio 3). Com `64` a conta daria 17,5.
> **Escrever sempre `[(90−59) + (68−54)]/2 = 22,5`.**

---

## 2. `peixoto-2x3`

**Fonte:** `contexto aulas/prof PEIXOTO/Capítulo 3.pdf`, p. 18–26 (tabela p. 18; `Xᵗy` p. 21;
erros p. 24; efeitos p. 25; coeficientes p. 26).

O mesmo exemplo do 2², acrescido da concentração do reagente. 2³ completo, 2 réplicas, 16 corridas.

**Fatores**

| Símbolo | Fator | Tipo | Nível `−1` | Nível `+1` |
|---|---|---|---|---|
| `x₁` | Temperatura | quantitativo | 313 K | 333 K |
| `x₂` | Catalisador | qualitativo | A | B |
| `x₃` | Concentração | quantitativo | 1.0 M | 1.5 M |

**Dados de entrada (completos)**

| Ensaio | T (K) | Cat. | Conc. (M) | `x₁` | `x₂` | `x₃` | Rép. 1 | Rép. 2 | Média | Variância |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 313 | A | 1.0 | −1 | −1 | −1 | 56 | 52 | 54.0 | 8.0 |
| 2 | 333 | A | 1.0 | +1 | −1 | −1 | 85 | 88 | 86.5 | 4.5 |
| 3 | 313 | B | 1.0 | −1 | +1 | −1 | 49 | 47 | 48.0 | 2.0 |
| 4 | 333 | B | 1.0 | +1 | +1 | −1 | 64 | 62 | 63.0 | 2.0 |
| 5 | 313 | A | 1.5 | −1 | −1 | +1 | 65 | 61 | 63.0 | 8.0 |
| 6 | 333 | A | 1.5 | +1 | −1 | +1 | 92 | 95 | 93.5 | 4.5 |
| 7 | 313 | B | 1.5 | −1 | +1 | +1 | 57 | 60 | 58.5 | 4.5 |
| 8 | 333 | B | 1.5 | +1 | +1 | +1 | 70 | 74 | 72.0 | 8.0 |

**Resultados**

| Efeito | Valor exato | Impresso p. 25 | Coeficiente `β̂` |
|---|---|---|---|
| `M` | 67.3125 | 67.3 ± 0.57 | 67.3125 |
| `E_T` | 22.875 | 22.9 ± 1.1 | 11.4375 |
| `E_Cat` | −13.875 | −13.9 ± 1.1 | −6.9375 |
| `E_Conc` | 8.875 | 8.9 ± 1.1 | 4.4375 |
| `E_T·Cat` | −8.625 | −8.6 ± 1.1 | −4.3125 |
| `E_T·Conc` | −0.875 | −0.9 ± 1.1 | −0.4375 |
| `E_Cat·Conc` | 0.875 | 0.9 ± 1.1 | 0.4375 |
| `E_T·Cat·Conc` | 0.125 | 0.1 ± 1.1 | 0.0625 |

| Grandeza | Valor exato | Impresso |
|---|---|---|
| `S²` combinada (8 GL) | 5.1875 | 5.2 (p. 24) |
| erro da média | 0.569402 | 0.57 |
| erro do efeito | 1.138804 | 1.1 |

Vetor `Xᵗy` da p. 21 (`2³M`, `2²E_T`, …) confere exatamente:
`538.5, 91.5, −55.5, 35.5, −34.5, −3.5, 3.5, 0.5`.

Leitura didática (p. 25): concentração é relevante mas praticamente não interage com os demais,
logo pode ser estudada em separado.

---

## 3. `peixoto-2a4`

**Fonte:** `contexto aulas/prof PEIXOTO/Capítulo 4.pdf`, p. 3–17 (dados p. 3; efeitos do completo
p. 4 e 7; meia-fração p. 5–8 e 11; fração complementar p. 14–16; recomposição p. 17).

Fatorial 2⁴ completo, sem réplica, 16 ensaios. Fatores anônimos (1, 2, 3, 4) no material.

**Dados de entrada (completos)** — ordem padrão, fator 1 variando mais rápido.

| Ensaio | 1 | 2 | 3 | 4 | Resposta |
|---|---|---|---|---|---|
| 1 | − | − | − | − | 52 |
| 2 | + | − | − | − | 61 |
| 3 | − | + | − | − | 124 |
| 4 | + | + | − | − | 113 |
| 5 | − | − | + | − | 85 |
| 6 | + | − | + | − | 66 |
| 7 | − | + | + | − | 185 |
| 8 | + | + | + | − | 192 |
| 9 | − | − | − | + | 98 |
| 10 | + | − | − | + | 86 |
| 11 | − | + | − | + | 201 |
| 12 | + | + | − | + | 194 |
| 13 | − | − | + | + | 122 |
| 14 | + | − | + | + | 139 |
| 15 | − | + | + | + | 289 |
| 16 | + | + | + | + | 286 |

**Efeitos do 2⁴ completo**

| Efeito | Valor exato | Impresso p. 4 |
|---|---|---|
| Média | 143.3125 | 143.31 |
| `E1` | **−2.375** | −2.3 ⚠ ver nota |
| `E2` | 109.375 | 109.38 |
| `E3` | 54.375 | 54.38 |
| `E4` | 67.125 | 67.13 |
| `E12` | −1.125 | −1.13 |
| `E13` | 2.875 | 2.88 |
| `E14` | 1.125 | 1.13 |
| `E23` | 25.625 | 25.63 |
| `E24` | 21.875 | 21.88 |
| `E34` | 9.875 | 9.88 |
| `E123` | 2.625 | 2.63 |
| `E124` | −2.625 | −2.63 |
| `E134` | 5.375 | 5.38 |
| `E234` | 0.125 | 0.13 |
| `E1234` | −8.875 | −8.88 |

⚠ **`E1` está impresso como `−2,3`; o valor exato é `−2,375`** (soma dos `+` = 1137, soma dos `−` = 1156,
`(1137 − 1156)/8 = −19/8`). Arredondado às mesmas duas casas dos demais seria `−2,38`.
Não é uma das três erratas confirmadas, mas **use `−2,375`**.

**Meia-fração `2⁴⁻¹` com geratriz `I = 1234`** — ensaios 1, 4, 6, 7, 10, 11, 13, 16.

| Grandeza | Valor | Impresso p. 6 |
|---|---|---|
| Média | 138.875 | 138.87 |
| `e1` | −2.25 | −2.25 |
| `e2` | 114.75 | 114.75 |
| `e3` | 51.75 | 51.75 |
| `e4` | 69.75 | 69.75 |
| `e12` = `e34` | 8.75 | 8.75 |
| `e13` = `e24` | 24.75 | 24.75 |
| `e14` = `e23` | 26.75 | 26.75 |

**Fração complementar `I = −1234`** — ensaios 2, 3, 5, 8, 9, 12, 14, 15. Média 147.75; `e*2 = 104.00`.

**Recomposição (dobramento), p. 17:** `(e2 + e*2)/2 = (114.75 + 104.00)/2 = 109.375 = E2`. ✔

Padrão de confundimento (p. 13): `1=234`, `2=134`, `3=124`, `4=123`, `12=34`, `13=24`, `14=23`, `I=1234`.

---

## 4. `peixoto-saturado`

**Fonte:** `contexto aulas/prof PEIXOTO/Capítulo 4.pdf`, p. 34–42 (construção p. 34–35;
dados p. 36; efeitos p. 37; desconfundimento p. 38–39; contrastes p. 40; `S_C` p. 41; intervalos p. 42).

Planejamento saturado `2⁷⁻⁴_III`: 7 fatores em 8 ensaios. Gerado a partir de um 2³ completo
com `4 = 12`, `5 = 13`, `6 = 23`, `7 = 123`. Resposta: conversão, em %.

**Dados de entrada (completos) — fração original**

| Ensaio | 1 | 2 | 3 | 4 = 12 | 5 = 13 | 6 = 23 | 7 = 123 | `y` (%) |
|---|---|---|---|---|---|---|---|---|
| 1 | − | − | − | + | + | + | − | 56 |
| 2 | + | − | − | − | − | + | + | 66 |
| 3 | − | + | − | − | + | − | + | 51 |
| 4 | + | + | − | + | − | − | − | 52 |
| 5 | − | − | + | + | − | − | + | 54 |
| 6 | + | − | + | − | + | − | − | 70 |
| 7 | − | + | + | − | − | + | − | 42 |
| 8 | + | + | + | + | + | + | + | 64 |

**Dados de entrada (completos) — fração de desconfundimento, `5* = −13`**

| Ensaio | 1 | 2 | 3 | 4 = 12 | 5* = −13 | 6 = 23 | 7 = 123 | `y` (%) |
|---|---|---|---|---|---|---|---|---|
| 1 | − | − | − | + | − | + | − | 52 |
| 2 | + | − | − | − | + | + | + | 74 |
| 3 | − | + | − | − | − | − | + | 50 |
| 4 | + | + | − | + | + | − | − | 60 |
| 5 | − | − | + | + | + | − | + | 54 |
| 6 | + | − | + | − | − | − | − | 62 |
| 7 | − | + | + | − | + | + | − | 50 |
| 8 | + | + | + | + | − | + | + | 63 |

**Resultados**

| `i` | `eᵢ` | `e*ᵢ` | `sᵢ = (eᵢ+e*ᵢ)/2` | `dᵢ = (eᵢ−e*ᵢ)/2` | `sᵢ` estima | `dᵢ` estima |
|---|---|---|---|---|---|---|
| 1 | 12.25 | 13.25 | 12.75 | −0.50 | `E1+E24+E67` | `E35` |
| 2 | −9.25 | −4.75 | −7.00 | −2.25 | `E2+E14+E36` | `E57` |
| 3 | 1.25 | −1.75 | −0.25 | 1.50 | `E3+E26+E47` | `E15` |
| 4 | −0.75 | −1.75 | −1.25 | 0.50 | `E4+E12+E37` | `E56` |
| 5 | 6.75 | 2.75 | 4.75 | 2.00 | `E5` | `E13+E46+E27` |
| 6 | 0.25 | 3.25 | 1.75 | −1.50 | `E6+E23+E17` | `E45` |
| 7 | 3.75 | 4.25 | 4.00 | −0.25 | `E7+E34+E16` | `E25` |

| Grandeza | Valor exato | Impresso |
|---|---|---|
| `S_C = √(Σdᵢ²/7)` | 1.420513 | 1.42 (p. 41) |

**Intervalos de confiança 95% da p. 42.** Reproduzem-se exatamente centrando em `eᵢ`
(e **não** em `sᵢ`) com `t* = 2,776`:

| Efeito | Recalculado | Impresso p. 42 | Contém zero? |
|---|---|---|---|
| `E1` | 8.31 … 16.19 | 8.3 … 16.2 | não → **significativo** |
| `E2` | −13.19 … −5.31 | −13.2 … −5.3 | não → **significativo** |
| `E3` | −2.69 … 5.19 | −2.7 … 5.2 | sim |
| `E4` | −4.69 … 3.19 | −4.7 … 3.2 | sim |
| `E5` | 2.81 … 10.69 | 2.8 … 10.7 | não → **significativo** |
| `E6` | −3.69 … 4.19 | −3.7 … 4.2 | sim |
| `E7` | **−0.19** … 7.69 | **0.2** … 7.7 ⚠ | **sim** → não significativo |

⚠ **O limite inferior de `E7` está impresso sem o sinal de menos.** O valor correto é `−0,19`.
Com o sinal correto o intervalo contém zero e `E7` **não** é significativo a 95%.
Os efeitos relevantes são apenas `E1`, `E2` e `E5`. Não propagar a versão impressa.

Nota metodológica: `S_C` é calculado com denominador 7 (7 valores de `dᵢ`), mas os intervalos
impressos correspondem a `t*` de 4 GL. Com os 7 GL sugeridos pela própria fórmula, `t* = 2,365`
e a semi-amplitude cairia de 3,944 para 3,359 (o que não muda nenhuma conclusão acima).
Ao reescrever, declarar explicitamente qual `t*` está sendo usado.

Leitura didática (p. 41): `E5` contribui com 4,75 dos 6,75 pontos atribuídos a `E5+E13+E46+E27`;
as interações binárias respondem por apenas 2 pontos.

---

## 5. `peixoto-lin-quad`

**Fonte:** `contexto aulas/prof PEIXOTO/Capítulo 5.pdf`, p. 32–34 (dados p. 32;
ajuste linear p. 33; ajuste quadrático p. 34).

Nove níveis de `x`, de 30 a 70 em passos de 5, com 2 réplicas cada — 18 observações.
É o exemplo canônico de falta de ajuste: o erro puro **não muda** entre os dois modelos;
o que muda é a falta de ajuste.

**Dados de entrada (completos)**

| `x` | `y` (rép. 1) | `y` (rép. 2) | `ȳᵢ` |
|---|---|---|---|
| 30 | 24 | 20 | 22.0 |
| 35 | 40 | 43 | 41.5 |
| 40 | 60 | 57 | 58.5 |
| 45 | 70 | 72 | 71.0 |
| 50 | 77 | 80 | 78.5 |
| 55 | 86 | 89 | 87.5 |
| 60 | 91 | 88 | 89.5 |
| 65 | 86 | 89 | 87.5 |
| 70 | 84 | 80 | 82.0 |

`ȳ = 68.666667`, `n = 18`, `m = 9` níveis.

**Comum aos dois modelos**

| Grandeza | Valor |
|---|---|
| `SQ_T` | 8930 (17 GL) |
| `SQ_ep` | 45 (9 GL) |
| `MQ_ep` | 5 |
| % máxima explicável `(SQ_T − SQ_ep)/SQ_T` | 0.994961 |

**Modelo linear** `ŷ = −7.416667 + 1.521667·x`

| Grandeza | Valor exato | Impresso p. 33 |
|---|---|---|
| `β̂₀` | −7.416667 | −7.41667 |
| `β̂₁` | 1.521667 | 1.521667 |
| `SQ_R` (1 GL) | 6946.408333 | 6946.409 |
| `SQ_r` (16 GL) | 1983.591667 | 1983.592 |
| `MQ_r` | 123.974479 | 123.9745 |
| `SQ_faj` (7 GL) | 1938.591667 | 1938.592 |
| `MQ_faj` | 276.941667 | 276.9417 |
| `R² = SQ_R/SQ_T` | 0.777873 | 0.777873 |
| `MQ_faj/MQ_ep` | 55.388333 | — (≈ 55,4) |
| `p` do `F(7, 9)` | 1.10 × 10⁻⁶ | — |

**Modelo quadrático** `ŷ = −172.416667 + 8.593095·x − 0.070714·x²`

| Grandeza | Valor exato | Impresso p. 34 |
|---|---|---|
| `β̂₀` | −172.416667 | −172.417 |
| `β̂₁` | 8.593095 | 8.593095 |
| `β̂₂` | −0.070714 | −0.07071 |
| `SQ_R` (2 GL) | 8871.604762 | 8871.592 ⚠ |
| `SQ_r` (15 GL) | 58.395238 | 58.39524 |
| `MQ_r` | 3.893016 | 3.893016 |
| `SQ_faj` (6 GL) | 13.395238 | 13.39524 |
| `MQ_faj` | 2.232540 | 2.23254 |
| `R²` | **0.993461** | 0.993459 ⚠ |
| `MQ_faj/MQ_ep` | 0.446508 | — (≈ 0,447) |
| `p` do `F(6, 9)` | 0.830703 | — |

⚠ **`SQ_R` e `R²` do modelo quadrático.** A planilha da p. 34 calcula `SQ_R = Σ(ŷᵢ − ȳ)²` a partir da
coluna de `ŷ` já arredondada, e por isso `SQ_R + SQ_r = 8929,99 ≠ SQ_T = 8930`. Recalculado sem
arredondamento intermediário, `SQ_R = 8871,604762` e `R² = 0,993461`.
Diferença de 1,8 × 10⁻⁶ em `R²`; **usar 0,993461**. O `SQ_r` impresso está correto.

Narrativa a preservar: `R²` sobe de 0,777873 para 0,993461, mas o argumento decisivo não é o `R²`
e sim a razão `MQ_faj/MQ_ep`, que cai de 55,4 (falta de ajuste gritante, `p ≈ 10⁻⁶`) para 0,447
(`p = 0,83`, nenhuma evidência de falta de ajuste). O erro puro é 45 nos dois casos, porque
depende só das réplicas, não do modelo.

---

## 6. `peixoto-potencia`

**Fonte:** `contexto aulas/prof PEIXOTO/Capítulo 5.pdf`, p. 21–22 (enunciado p. 21;
tabela resolvida p. 22).

Velocidade de queima de uma pólvora, `v = k·Pᵃ`, linearizada por logaritmo. 18 pontos, sem réplica.

⚠ **A p. 21 e a p. 22 trazem colunas `v` diferentes.** A p. 21 é o enunciado; a p. 22 é a resolução,
e é a **p. 22 que reproduz os resultados impressos**. Use os valores da p. 22.

⚠ **O cabeçalho da p. 22 escreve `x = ln(P)` e `y = ln(v)`, mas os números da planilha são log
decimal** (`log₁₀ 5 = 0,69897`, não `ln 5 = 1,6094`). A regressão foi feita em base 10.
Isso não altera `β̂₁ = a`, mas altera `k`: `log₁₀ k = 0,592346`, logo `k = 3,9115`.

**Dados de entrada (completos), da p. 22**

| `P` (psi) | `v` (mm/s) | `x = log₁₀ P` | `y = log₁₀ v` | | `P` (psi) | `v` (mm/s) | `x = log₁₀ P` | `y = log₁₀ v` |
|---|---|---|---|---|---|---|---|---|
| 1 | 4.0 | 0.000000 | 0.602060 | | 37 | 16.1 | 1.568202 | 1.206826 |
| 5 | 7.2 | 0.698970 | 0.857332 | | 41 | 16.8 | 1.612784 | 1.225309 |
| 9 | 9.2 | 0.954243 | 0.963788 | | 45 | 17.4 | 1.653213 | 1.240549 |
| 13 | 10.6 | 1.113943 | 1.025306 | | 49 | 18.0 | 1.690196 | 1.255273 |
| 17 | 11.8 | 1.230449 | 1.071882 | | 53 | 18.6 | 1.724276 | 1.269513 |
| 21 | 12.8 | 1.322219 | 1.107210 | | 57 | 19.1 | 1.755875 | 1.281033 |
| 25 | 13.8 | 1.397940 | 1.139879 | | 61 | 19.7 | 1.785330 | 1.294466 |
| 29 | 14.6 | 1.462398 | 1.164353 | | 65 | 20.2 | 1.812913 | 1.305351 |
| 33 | 15.4 | 1.518514 | 1.187521 | | 69 | 20.7 | 1.838849 | 1.315970 |

Para referência, a coluna `v` do enunciado da p. 21 (**não usar nos resultados**):
4.5, 7.1, 9.9, 11.1, 12, 13.8, 14.5, 15, 16.5, 17, 17.5, 18, 19.1, 19.5, 20.1, 20.2, 21.2, 21.8.

**Resultados** (modelo na forma centrada `ŷ = β̂₀ + β̂₁(x − x̄)`, como na p. 19)

| Grandeza | Valor | Impresso p. 22 |
|---|---|---|
| `n` | 18 | 18 |
| `x̄` | 1.396684 | 1.396684 |
| `β̂₀` (= `ȳ`) | 1.139646 | 1.139646 / 1.139645666 |
| `β̂₁` | 0.391856 | 0.391856386 |
| `Σ(xᵢ−x̄)²` | 3.749780 | 3.749779928 |
| `Σ(xᵢ−x̄)yᵢ` | 1.469375 | 1.46937521 |
| `SQ_R` (1 GL) | 0.575784 | 0.575784059 |
| `SQ_r` (16 GL) | 0.000238 | 0.000237808 |
| `SQ_T` | 0.576022 | 0.576021866 |
| `MQ_r` | 1.486 × 10⁻⁵ | 1.49 × 10⁻⁵ |
| `R²` | 0.999587 | 0.999587155 |
| `s` | 0.003855 | 0.003855 |
| `t` 95% (16 GL) | 2.119905 | 2.119905299 |
| `t` 99% (16 GL) | 2.920782 | 2.920781622 |
| IC 95% de `β̂₀` | ± 0.001926 | ± 0.00192634 |
| IC 95% de `β̂₁` | ± 0.004221 | ± 0.004220524 |
| `F = MQ_R/MQ_r` | 38 739.5 | — |

Modelo em unidades naturais: `v = 3,9115 · P^0,391856` (com `log₁₀ k = 0,592346`).

---

## 7. `origin-2x2`

**Fonte:** `contexto aulas/DOE Analysis.pdf` (relatório OriginPro de 25/02/2025, p. 1).

Fatorial 2² com 2 réplicas (8 corridas), modelo **só de efeitos principais** (sem interação).
Resposta `DP`. Fatores `Fiber_Percentage` e `Cement_Percentage`.

⚠ **Os dados brutos não estão impressos no relatório.** A verificação foi feita por
identidades fechadas e por um conjunto equivalente em estatísticas suficientes
(`backend/tests/audit/fixtures/originpro_2x2_maineffects.json`). Nas apostilas este conjunto
serve para discutir **saídas de software**, não para tabelar dados de entrada.

**Resultados (todos verificados)**

| Grandeza | Valor |
|---|---|
| Intercepto | 4.125 |
| Coef. `Fiber` (efeito 0.85) | 0.425 |
| Coef. `Cement` (efeito −3.5) | −1.75 |
| Erro-padrão dos coeficientes | 1.11434 |
| `t` de `Fiber` / `p` | 0.38139 / 0.71858 |
| `t` de `Cement` / `p` | −1.57044 / 0.17711 |
| IC 95% de `Fiber` | −2.4395 … 3.2895 |
| IC 95% de `Cement` | −4.6145 … 1.1145 |
| GL do erro | 5 |
| `t` crítico 95% (5 GL) | 2.570582 (impresso 2.571) |
| RMSE | 3.15182 |
| `R²` | 0.34312 |
| `R²` ajustado | 0.08037 |
| PRESS | 127.1552 |
| `SQ` do resíduo | 49.67 |
| `SQ` total | 75.615 |
| ANOVA `Fiber` | SS 1.445, `F` 0.14546, `p` 0.71858 |
| ANOVA `Cement` | SS 24.5, `F` 2.46628, `p` 0.17711 |
| `R²` predito **real** | **−0.68161** |

⚠ **O OriginPro imprime `Predicted R-Square = 0`.** Ele trunca valores negativos em zero.
O valor real é `1 − PRESS/SS_T = −0,68161`, e é ele que carrega a informação:
`R²` predito negativo significa que o modelo prevê pior do que a média — sinal de sobreajuste.
O motor do projeto reporta o valor real. **Escrever −0,68 e explicar o truncamento.**

Este conjunto é o melhor exemplo didático de "`R²` alto não é sinônimo de modelo bom":
aqui `R² = 0,34`, `R²` ajustado 0,08 e `R²` predito negativo contam a mesma história.

---

## 8. `origin-ccd`

**Fonte:** `contexto aulas/Doe ANalysis pra superficie d resposta.pdf`
(relatório OriginPro de 25/02/2025, p. 1).

Composição central `k = 2` em 2 blocos: 4 fatoriais + 4 axiais + 3 + 3 centrais = 14 corridas.
Modelo linear com termo de bloco. Resposta `DP`.

⚠ **Dados brutos não impressos**; verificação por identidades fechadas e por reconstrução da
partição erro puro / falta de ajuste
(`backend/tests/audit/fixtures/originpro_ccd_blocks.json`).

**Resultados (todos verificados)**

| Grandeza | Valor |
|---|---|
| Intercepto | 11.5 |
| Coef. `Blocks1` | 0.78571 (= 11/14) |
| Coef. `Percentage_Fiber` | 4.95375 |
| Coef. `Percentage_Cement` | 3.93609 |
| Erro-padrão do intercepto e do bloco | 1.68744 |
| Erro-padrão dos dois fatores | 2.23245 |
| `t` / `p` de `Fiber` | 2.21898 / 0.05078 |
| `t` / `p` de `Cement` | 1.76313 / 0.10835 |
| `t` / `p` do bloco | 0.46562 / 0.65146 |
| GL do erro | 10 |
| `t` crítico 95% (10 GL) | 2.228139 (impresso 2.228) |
| RMSE | 6.31384 |
| `R²` | 0.45203 |
| `R²` ajustado | 0.28764 |
| PRESS | 864.33625 |
| `SQ` do resíduo | 398.64584 |
| `SQ` total | 727.5 |
| ANOVA blocos | SS 8.642857 (= 121/14), `F` 0.21681 |
| ANOVA `Fiber` | SS 196.28731, `F` 4.92385 |
| ANOVA `Cement` | SS 123.92399, `F` 3.10862 |
| **Falta de ajuste** | SS 361.3125, 6 GL, MS 60.21875, `F` **6.45201**, `p` **0.04628** |
| **Erro puro** | SS 37.33333, 4 GL, MS 9.33333 |
| `R²` predito **real** | **−0.18809** (impresso 0, truncado) |

O erro puro tem 4 GL porque são dois grupos de 3 pontos centrais, um por bloco: `(3−1) + (3−1) = 4`.

Este é o conjunto de referência para ensinar falta de ajuste: `p = 0,046 < 0,05` significa que
um modelo puramente linear é insuficiente e que os termos quadráticos precisam entrar —
exatamente o argumento que motiva a composição central.

⚠ **Nota de reprodutibilidade.** O OriginPro usa `α = 1,414` (√2 truncado) no CCD rotacionável;
o motor usa `√2` exato. A diferença aparece na sétima casa do erro-padrão (1,7 × 10⁻⁶) e é
irrelevante para o texto, mas explica qualquer divergência de último dígito.

---

## 9. `aula-statistica`

**Fonte:** `docs/adp/reference-outputs.md`, seções 1 e 2, transcritas dos slides
"Exemplo 2 — Aplicação do DoE" da aula antiga
(`contexto aulas/aula antiga/Design of Experiments (DoE).pdf`, p. 20–30).

Fatorial 2² com 2 réplicas (8 corridas), **modelo com interação**, painel do Statistica.
Fatores rotulados "Tensão Desvio" e "Umidade"; resposta "Deformação Permanente".

⚠ **Os slides trazem apenas capturas de tela do painel; a tabela de entrada do Statistica não é
impressa.** A melhor reconstrução é a coluna `DP_10000` do workbook do OriginPro (p. 23 dos slides,
transcrita em `reference-outputs.md` linhas 29–38), com "Tensão Desvio" ≡ `par` e
"Umidade" ≡ `cond`. Essa reconstrução reproduz o painel dentro de **0,001 em cada efeito** —
exatamente a margem de arredondar as 8 respostas a 3 casas decimais.
**Nas apostilas, apresentar os números do painel como saída de software, não como recálculo exato.**

**Dados de entrada da reconstrução** (mesmos 8 ensaios do conjunto 10, resposta `DP_10000`)

| Run | Std | `cond` | `par` | `DP_10000` |
|---|---|---|---|---|
| 1 | 2 | +1 (19) | −1 (70,70) | 3.448 |
| 2 | 1 | −1 (18) | −1 (70,70) | 0.591 |
| 3 | 4 | +1 (19) | +1 (210,70) | 8.972 |
| 4 | 3 | −1 (18) | +1 (210,70) | 5.094 |
| 5 | 5 | −1 (18) | −1 (70,70) | 0.634 |
| 6 | 6 | +1 (19) | −1 (70,70) | 1.599 |
| 7 | 8 | +1 (19) | +1 (210,70) | 6.204 |
| 8 | 7 | −1 (18) | +1 (210,70) | 3.334 |

**Resultados do painel (valores a citar)**

| Grandeza | Painel Statistica | Reconstrução `DP_10000` |
|---|---|---|
| `R²` | 0.88132 | 0.881190 |
| `R²` ajustado | 0.79231 | 0.792083 |
| MQ do erro puro | 1.770662 | 1.772509 |
| `SQ` total | 59.67792 | 59.675612 |
| Efeito Tensão Desvio | 4.334000 | 4.333 |
| Efeito Umidade | 2.641500 | 2.6425 |
| Efeito da interação | 0.732500 | 0.7315 |
| Média / intercepto | 3.734010 | 3.7345 |

**ANOVA do painel (Tabela 4)**

| Fonte | SS | GL | MS | `F` | `p` |
|---|---|---|---|---|---|
| (1) Tensão Desvio | 37.56711 | 1 | 37.56711 | 21.21642 | 0.009985 |
| (2) Umidade | 13.95504 | 1 | 13.95504 | 7.88126 | 0.048447 |
| 1 by 2 (interação) | 1.07311 | 1 | 1.07311 | 0.60605 | 0.479760 |
| Erro puro | 7.08265 | 4 | 1.77066 | | |
| Total | 59.67792 | 7 | | | |

**Estimativa dos efeitos (Tabela 5)** — colunas `Effect | Std.Err. Pure Err | t(4) | p | Coeff.`

| Termo | Efeito | `t(4)` | `p` | Coeficiente |
|---|---|---|---|---|
| Média / intercepto | 3.734010 | 7.936910 | 0.001364 | — |
| (1) Tensão Desvio | 4.334000 | 4.606128 | 0.009985 | 2.167000 |
| (2) Umidade | 2.641500 | 2.807358 | 0.048447 | 1.320750 |
| 1 by 2 | 0.732500 | 0.778493 | 0.479760 | 0.366250 |

**Coeficientes em unidades naturais (Tabela 6):**
intercepto −15.3063; Tensão Desvio −0.0998; Umidade 0.7843; interação 0.0070.

Leitura didática: a interação tem `p = 0,48` e pode sair do modelo; os dois efeitos principais são
significativos a 5 %. É o exemplo pronto para o gráfico de Pareto dos efeitos padronizados
com linha de corte em `p = 0,05`.

---

## 10. `aula-originpro`

**Fonte:** `docs/adp/reference-outputs.md`, linhas 29–38 (dados) e 7–24 (validação).
Slides da aula antiga, p. 23 e 26–27.

Os **mesmos 8 ensaios** do conjunto 9, resposta `DP_50000`, modelo **só de efeitos principais**.
É o golden test primário do projeto: `statsmodels` reproduz o OriginPro em 5 casas decimais.

**Dados de entrada (completos)**

Codificação: `cond` 18 → −1, 19 → +1; `par` (70,70) → −1, (210,70) → +1.

| Run | Std | `cond` | `par` | `DP_10000` | `DP_50000` |
|---|---|---|---|---|---|
| 1 | 2 | +1 (19) | −1 (70,70) | 3.448 | 3.475 |
| 2 | 1 | −1 (18) | −1 (70,70) | 0.591 | 0.612 |
| 3 | 4 | +1 (19) | +1 (210,70) | 8.972 | 9.041 |
| 4 | 3 | −1 (18) | +1 (210,70) | 5.094 | 5.168 |
| 5 | 5 | −1 (18) | −1 (70,70) | 0.634 | 0.645 |
| 6 | 6 | +1 (19) | −1 (70,70) | 1.599 | 1.623 |
| 7 | 8 | +1 (19) | +1 (210,70) | 6.204 | 6.270 |
| 8 | 7 | −1 (18) | +1 (210,70) | 3.334 | 3.447 |

**Resultados sobre `DP_50000`, modelo linear**

| Grandeza | Motor (statsmodels) | OriginPro |
|---|---|---|
| Coef. intercepto | 3.785125 | 3.78513 |
| Coef. `cond` (efeito 2.63425) | 1.317125 | 1.31713 |
| Coef. `par` (efeito 4.39275) | 2.196375 | 2.19638 |
| `F` / `p` de `cond` | 8.615382 / 0.032437 | 8.61538 / 0.03244 |
| `F` / `p` de `par` | 23.957061 / 0.004496 | 23.95706 / 0.00450 |
| `R²` | 0.866924 | 0.86692 |
| `R²` ajustado | 0.813693 | 0.81369 |
| RMSE | 1.269214 | 1.26921 |
| **PRESS** | **20.61956** | **20.61956** |
| **`R²` predito** | **0.659325** | **0.65932** |
| `SQ` total | 60.525567 | 60.52557 |

Contraste didático direto com o conjunto 7: aqui o `R²` predito é 0,66 (positivo e próximo do
`R²` ajustado 0,81), sinal de um modelo que generaliza; lá era −0,68.

---

## 11. `armaradar`

**Fonte:** `contexto aulas/prof PEIXOTO/Capítulos 1 e 2.pdf`, p. 47–53
(dados p. 47; sem blocagem p. 52; com blocagem p. 53).

Comparação de dois tratamentos: um fator (conjunto arma-radar) em dois níveis, medido com
munições de 5 fabricantes diferentes. É o exemplo que justifica blocagem antes de qualquer
fatorial aparecer.

**Dados de entrada (completos)** — velocidades em m/s.

| Amostra (fabricante) | (Arma-radar)₁ | (Arma-radar)₂ | `d` |
|---|---|---|---|
| 1 | 377 | 362 | 15 |
| 2 | 385 | 369 | 16 |
| 3 | 407 | 410 | −3 |
| 4 | 483 | 470 | 13 |
| 5 | 505 | 489 | 16 |
| **Média** | **431.4** | **420.0** | **11.4** |
| **Desvio-padrão** | 58.709454 | 57.719148 | 8.142481 |
| **GL** | 4 | 4 | 4 |

⚠ O cabeçalho da tabela na p. 47 escreve a unidade como `m/2`; o texto da p. 52 confirma `m/s`.

**Resultados**

| Análise | `S` | `t*` | Semi-amplitude | Intervalo | Contém zero? |
|---|---|---|---|---|---|
| **Sem blocagem** (2 amostras, 8 GL) | 58.216407 | 2.306004 | **84.9054** | 11.4 ± 84.91 | **sim** |
| **Com blocagem** (pareado, 4 GL) | 8.142481 | 2.776445 | **10.1102** | 11.4 ± 10.11 | **não** |

Teste `t` equivalente: pareado `t = 3.13064`, `p = 0.03516`; duas amostras `t = 0.30962`, `p = 0.76476`.

⚠ **A p. 52 imprime `11,4 ± 84,1`; o recálculo dá `± 84,91`.** Com `S = 58,22` e `t* = 2,306`
impressos na própria aula, `2,306 × 58,22 × √(1/5 + 1/5) = 84,91`. Nenhuma variante plausível
(usar `S_A`, `S_B`, outro GL) produz 84,1; trata-se de erro de digitação.
A conclusão não muda — o intervalo contém zero nos dois casos. **Escrever ± 84,91.**

⚠ A p. 53 imprime `± 10,10`; o valor exato é `10,1102` (com `S` e `t*` arredondados da própria
aula, 10,1055). Diferença de truncamento, sem consequência. **Escrever ± 10,11.**

Mensagem didática: os mesmos 10 números levam a conclusões opostas conforme se reconheça ou não
o fabricante como bloco. Sem blocagem, a variabilidade entre fabricantes (de 377 a 505 m/s)
engole a diferença de 11,4 m/s entre os conjuntos. Com blocagem, ela aparece.

---

# Erratas do material original

Três erratas confirmadas na auditoria de 24/07/2026
(`docs/adp/auditoria-aulas-2026-07.md`). **Nenhuma delas pode ser propagada para as apostilas,
para o deck ou para as figuras.**

## Errata 1 — numerador de `E_T` em Peixoto cap. 3, p. 3

O material imprime

> `E_T = [(y₂ − y₁) + (y₄ − y₃)]/2 = [(90 − 59) + (68 − 64)]/2 = 22,5 %`

O `64` está errado. O valor correto é `54`, que é a média do ensaio 3
(níveis 313 K e catalisador B, respostas 55 e 53). **O resultado 22,5 está certo**;
apenas o numerador foi digitado errado. Com `64` a conta daria 17,5.

**Forma correta:** `E_T = [(90 − 59) + (68 − 54)]/2 = 22,5 %`.

Afeta o conjunto [`peixoto-2x2`](#1-peixoto-2x2). Verificado no motor: `E_T = 22,5` exato.

## Errata 2 — teste `F` bicaudal na UFSC parte 1

`contexto aulas/Cap4_Planejamento_Experimentos_Parte1.pdf`, p. 19 (slide 21). O material apresenta

> `F_{α/2} ≤ F₀ ≤ F_{1−α/2}` ⇒ falha em rejeitar `H₀`

isto é, uma região de rejeição **bicaudal**, com `H₁: σ²_trat ≠ σ²_E` declarada como
"hipótese alternativa bilateral".

O teste `F` da ANOVA é **unicaudal à direita**. Sob `H₁` a média quadrática dos tratamentos só
pode ser **maior** que a do erro, porque `E[MQ_trat] = σ²_G + (n/(a−1))·Στᵢ² ≥ σ²_G = E[MQ_E]`.
Não existe hipótese alternativa que produza `F₀` pequeno demais. A convenção padrão — e a do
motor do projeto — é rejeitar `H₀` quando `F₀ > F_α(ν_trat, ν_E)`, com `p = P(F > F₀)`.

Note que a mesma página escreve `H₁: τᵢ ≠ 0` para pelo menos um nível como "hipótese alternativa
**unilateral**", o que é a redação correta e contradiz o quadro de decisão logo abaixo.

**Nas apostilas usar sempre `F_α` unicaudal** e `p` como área da cauda superior.
Os exemplos numéricos da própria aula não são afetados, porque nenhum deles chega a comparar
com o quantil bicaudal.

## Errata 3 — dados de resistência de polímeros da UFSC parte 1, p. 10

`contexto aulas/Cap4_Planejamento_Experimentos_Parte1.pdf`, p. 10 (slide 11).
Exemplo "Resistência de Polímeros à Tração": quatro níveis de concentração de agente de
reticulação (5, 10, 15 e 20 %) com seis réplicas cada.

| Concentração (%) | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| 5 | 7 | 8 | 15 | 11 | 9 | 10 |
| 10 | 12 | 17 | 13 | 18 | 19 | 15 |
| 15 | 14 | 18 | 19 | 17 | 16 | 18 |
| 20 | 19 | 25 | 22 | 23 | 18 | 20 |

**São dados placeholder: descartar.** O material nunca calcula a ANOVA deste conjunto —
a apresentação passa direto do enunciado para a teoria e depois para um exercício com dados
de outro artigo (p. 22). Não há tabela ANOVA, `F`, `p` nem teste de Fisher associados a ele
em lugar nenhum do arquivo, de modo que não existe nada a conferir e nada a citar.

**Não usar este conjunto em apostila, deck ou figura.** Para ANOVA de fator único com mais de
dois níveis, escrever um exemplo próprio ou usar um dos conjuntos deste banco.

---

# Discrepâncias adicionais encontradas na conferência

Não são as três erratas confirmadas, mas foram detectadas ao recalcular e **também não devem
ser propagadas**. Cada uma está documentada em detalhe no conjunto correspondente.

| # | Onde | Impresso | Correto | Muda conclusão? |
|---|---|---|---|---|
| A | Peixoto cap. 4, p. 4 — `E1` do 2⁴ | −2,3 | **−2,375** | não (efeito desprezível nos dois casos) |
| B | Peixoto cap. 4, p. 42 — limite inferior de `E7` | 0,2 | **−0,19** | **sim**: com o sinal correto o IC contém zero e `E7` deixa de ser significativo |
| C | Peixoto cap. 5, p. 34 — `SQ_R` e `R²` do quadrático | 8871,592 / 0,993459 | **8871,604762 / 0,993461** | não (arredondamento intermediário) |
| D | Peixoto cap. 5, p. 21 × p. 22 — coluna `v` | duas colunas diferentes | usar a da **p. 22** | sim, se a p. 21 for usada |
| E | Peixoto cap. 5, p. 22 — rótulo `ln` | `x = ln(P)` | **`x = log₁₀(P)`** | altera `k`, não altera `a` |
| F | Peixoto cap. 1–2, p. 52 — IC sem blocagem | ± 84,1 | **± 84,91** | não (contém zero nos dois casos) |
| G | Peixoto cap. 1–2, p. 47 — unidade | m/2 | **m/s** | não |
| H | OriginPro, ambos os relatórios — `R²` predito | 0 | **−0,68161** e **−0,18809** | sim: o truncamento esconde o sobreajuste |

---

# Procedência dos conjuntos sem dados brutos

Três conjuntos não têm os dados de entrada impressos na fonte. O tratamento adotado:

| Conjunto | Situação | Como foi verificado | O que pode ser escrito |
|---|---|---|---|
| `origin-2x2` | relatório sem tabela de dados | identidades fechadas do próprio relatório + conjunto equivalente em estatísticas suficientes | as saídas, como exemplo de painel de software |
| `origin-ccd` | idem | identidades fechadas + reconstrução da partição erro puro / falta de ajuste | idem |
| `aula-statistica` | painel em captura de tela; entrada não impressa | reconstrução por `DP_10000` do workbook, concordância ≤ 0,001 por efeito | as saídas do painel; a entrada só como "reconstrução aproximada" |

Para figuras que precisem de dados de entrada reais, usar `peixoto-2x2`, `peixoto-2x3`,
`peixoto-2a4`, `peixoto-saturado`, `peixoto-lin-quad`, `peixoto-potencia`, `aula-originpro`
ou `armaradar`, que têm a tabela completa acima.

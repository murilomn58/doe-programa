# Decisão de bibliotecas de geração de design (VERIFICADO EMPIRICAMENTE)

> Pesquisa fina (Jul/2026) + verificação adversarial + **teste empírico local** (instalei e rodei pyDOE3 1.6.2 e definitive-screening-design). Resolve a confusão pyDOE2/pyDOE3/pydoe de uma vez.

## Conclusão: pyDOE3 1.6.2 é a lib ÚNICA de geração

Instalei `pyDOE3==1.6.2` e confirmei que **um só pacote** cobre quase todo o escopo de geração do v1. BSD-3, deps de runtime **só numpy+scipy** (já no stack via statsmodels), Python puro sem extensão compilada → bundle offline trivial.

| Família (v1) | Como fazer no pyDOE3 1.6.2 | Verificado |
|--------------|---------------------------|------------|
| Fatorial completo 2^k | `ff2n(k)` → matriz ±1 | ✅ `ff2n(3)` = (8,3) |
| Fatorial geral / multinível | `fullfact`, `gsd` | ✅ exportados |
| Fatorial fracionado 2^(k-p) | `fracfact('a b ab')`, `fracfact_by_res`, `fracfact_aliasing` | ✅ `fracfact` = (4,3) |
| CCD | `ccdesign(k, center, alpha, face)` | ✅ `ccdesign(3)` = (22,3) |
| Box-Behnken | `bbdesign(k)` | ✅ `bbdesign(3)` = (15,3) |
| Plackett-Burman | `pbdesign` | ✅ exportado |
| **Taguchi (OA + S/N)** | `doe_taguchi`: `get_orthogonal_array`, `taguchi_design`, `compute_snr`, `TaguchiObjective` | ✅ catálogo L4→L32; `L9(3^4)`=(9,4) |
| **D/I-optimal** | `doe_optimal`: `optimal_design`, `d_optimality`, `i_optimality`, `fedorov`, `modified_fedorov`, `detmax` | ✅ módulo existe (não era fantasma) |

Catálogo Taguchi confirmado: `L4(2^3), L8(2^7), L9(3^4), L12(2^11), L16(2^15), L16(4^5), L18(6^1 3^6), L25(5^6), L27(2^1 3^12), L32(2^31)...`

**Correção da ADR-004**: NÃO é "pydoe 1.3.0" nem "pyDOE2". É **`pyDOE3==1.6.2`** (fork ativo de Rémi Lafage, release 2026-01-12). O "pydoe 1.3.0" que o primeiro workflow sugeriu é na verdade o pyDOE2 renomeado — sem módulo Taguchi.

## Única família que precisa de lib separada: DSD categórico

`definitive-screening-design==0.5.0` (autor danieleongari). BSD-3, numpy+pandas. **Verificado numericamente**: `dsd.generate(n_num=3, n_cat=2, method='dsd')` → 14 corridas com correlação EXATA 0 entre efeitos principais (incl. categóricos) e todos os 2FI/quadráticos (implementação Jones-Nachtsheim 2013). Só suporta categórico de **2 níveis** (perfeito para Tucum/Piassava).
- ⚠️ **Bus-factor**: mantenedor único, dormante (último release mai/2024). **Mitigação: VENDORAR** `design.py` (Python puro, numpy+pandas) em `backend/vendor/dsd/` — corta matplotlib/seaborn e elimina a dependência frágil.

## pyoptex: NÃO no v1 por padrão (só se split-plot for necessário)

`pyoptex 1.2.1` trata categórico first-class E suporta **split-plot** (para fator hard-to-change). MAS puxa deps pesadas (numba, plotly, kaleido, scikit-learn) que complicam o bundle offline no Windows. **Decisão default**: usar o `doe_optimal` do pyDOE3 (leve) para D/I-optimal com categórico via model matrix manual. Adotar pyoptex só se confirmarmos que "tipo de fibra" é hard-to-change (→ split-plot).

## Gotchas de implementação (do research + verificação)
- `fullfact` devolve 0..L-1 (recodificar para ±1); `ff2n` já vem ±1.
- **D/I-optimal com categórico**: montar o model matrix manualmente (numpy/pandas get_dummies), **NUNCA** gerar dummy² do categórico (coluna constante → X'X singular). Garantir `n_runs ≥ n_params`.
- **Taguchi**: `compute_snr` é por-run (recebe as réplicas de UM ensaio, não a coluna toda). Fator categórico entra natural como coluna de rótulos. Fórmulas S/N: LARGER=−10·log10(mean(1/y²)); SMALLER=−10·log10(mean(y²)); NOMINAL=10·log10(mean²/var).
- **DSD**: exige `method='dsd'` (default); `method='orth'` quebra a propriedade de de-aliasing.

## Duas perguntas em aberto (defaults reversíveis assumidos; confirmar no Gate 2/PRD)
1. **Taguchi 3-níveis clássico puro**: pyDOE3 embute as variantes de nível MISTO L18(6^1 3^6)/L27(2^1 3^12), não as clássicas puras L18(2^1 3^7)/L27(3^13). **Default**: usar o catálogo embutido; adicionar as 2 tabelas clássicas (JSON domínio público York/Sloane) só se necessário.
2. **Fator "tipo de fibra" é hard-to-change?** Se sim → design ótimo split-plot (pyoptex). **Default**: tratar como fácil-de-mudar → exchange leve do pyDOE3 (sem deps novas).

## requirements (geração)
```
pyDOE3==1.6.2
definitive-screening-design==0.5.0   # ou vendorar design.py
# pyoptex==1.2.1                      # só se split-plot confirmado (Fase 2)
```

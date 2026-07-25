# Auditoria científica — motor DoE × material das aulas (24/07/2026)

Material auditado: `contexto aulas/` completo — Cap4 partes 1-5 (ENQ41003/UFSC, prof. Bruno Oechsler), 2 relatórios OriginPro ("DOE Analysis.pdf", "Doe ANalysis pra superficie d resposta.pdf"), prof. Peixoto caps 1-5 + Experimento1.xlsx.

## VEREDITO DAS CONTAS: ✅ CORRETAS

O motor (`statsmodels` via `services/analysis_service.py` — o MESMO código que roda no browser via Pyodide) foi verificado por **três caminhos independentes**:

1. **Motor × números impressos nas aulas** (tolerância = casas impressas): reproduz TODOS.
2. **Motor × recomputação manual em numpy puro** (efeitos por contraste, (XᵀX)⁻¹Xᵀy, SS, F, PRESS via hat): concordância em ~1e-9.
3. **Identidades internas dos relatórios OriginPro** (SE=RMSE/√Sxx, t=coef/SE, F=t², IC com t crítico, R², PRESS=(1/(1−h))²·SSE): todas fecham.

Rodável a qualquer momento: `cd backend && python -m tests.audit.verify_aulas` (~60 verificações) e `pytest tests/test_golden_aulas.py tests/test_blocks_curvature.py`.

### Casos validados número a número
| Caso | Fonte | Destaques verificados |
|---|---|---|
| Peixoto 2² (dados brutos reais: 57/61, 92/88, 55/53, 66/70) | Peixoto Cap.3 | efeitos 22,5/−13,5/−8,5; coefs 11,25/−6,75/−4,25; M=67,75±0,9; S²pooled=6,5; SE efeito=1,80 — tudo em 1e-9 |
| OriginPro 2² main-effects | DOE Analysis.pdf | coefs 0,425/−1,75; R²=0,34312; R²aj=0,08037; PRESS=127,1552; ANOVA F/p; ICs — dataset equivalente por estatísticas suficientes reproduz o relatório inteiro |
| OriginPro CCD 2 blocos | Doe superficie.pdf | coefs 11,5/0,78571/4,95375/3,93609; ANOVA por termo; **LoF SS=361,3125 F=6,45201 p=0,04628; Erro Puro 37,33333 (df 4)** — motor com termo Bloco reproduz tudo |

### Descobertas da auditoria (não são bugs do motor)
- **OriginPro usa α=1,414 (√2 truncado)** no CCD rotacionável — detectado pelo SE/SS (diff 1,7e-6). O motor usa √2 exato; diferença numérica desprezível, documentada.
- **OriginPro clampa Predicted R² negativo em 0** (imprime 0 quando 1−PRESS/SST=−0,68). O motor reporta o valor real — mais informativo (indica overfitting); convenção mantida.
- **Errata na aula (Peixoto Cap.3 p.3):** o numerador de E_T está impresso "(68−64)" mas o valor usado é 54 (média do ensaio 3); o resultado 22,5 está correto.
- **Notação da aula (Cap4 p1):** usa F_{α/2} (bicaudal) para o teste F da ANOVA; a convenção padrão (e do motor) é unicaudal F_α. Os exemplos da aula não são afetados.
- Exemplo 1 da parte 1 (resistência de polímeros) tem dados placeholder no PDF — descartado.

## GAPS FECHADOS nesta auditoria (aprovados pelo Murilo)
1. **Teste de curvatura via pontos centrais** (aula Cap.4 p4): `stats_service.curvature_test` — SS_curv = nF·nC·(ȲF−ȲC)²/(nF+nC), F(1, nC−1) contra o MQE dos centrais. Aparece como linha "Curvatura" na ANOVA (app + relatório) quando o modelo não tem termos quadráticos, todos os fatores são quantitativos e há ≥2 centrais + pontos fatoriais; warning didático quando p<0,05 ("considere CCD").
2. **Blocos na análise**: com exatamente 2 blocos, o termo qualitativo "Bloco" (±1) entra no modelo, como o OriginPro — ajusta coeficientes, ANOVA e erro. Plots/profiler seguem no espaço dos fatores (em design balanceado os coeficientes dos fatores não mudam; superfície = média entre blocos). >2 blocos: fora do escopo atual (documentado).

## Matriz de cobertura (aulas × app)
| Técnica ensinada | Status no app |
|---|---|
| Fatorial 2^k, codificação ±1, efeitos/interações, ANOVA, F | ✅ (golden CA1/CA2 + aulas) |
| Fracionado 2^(k-p), resolução III/IV/V, aliasing | ✅ |
| CCD (rotacionável/ortogonal/face), Box-Behnken, PB, Taguchi (+S/N), D-optimal, DSD | ✅ |
| Erro puro + falta de ajuste | ✅ agora com golden (OriginPro) |
| Curvatura com pontos centrais | ✅ NOVO |
| Blocos na análise (2 blocos) | ✅ NOVO |
| PRESS, R²pred, VIF, Lenth, half-normal, influência, profiler | ✅ |
| Erro-padrão de efeitos via pooled (efeito±erro, Peixoto) | ✅ (≡ OLS em balanceado, verificado 1e-9) |

## Backlog recomendado (não bloqueante)
- ANOVA de fator único multi-nível (>2) + Fisher LSD pós-ANOVA (Cap4 p1) — exige UI one-way.
- RCBD completo (fator × bloco multi-nível) — o exemplo da aula (atividade catalítica, F=125,75/34,07) está na fixture `peixoto`-style pronto pra virar golden quando implementado.
- Daniel plot (normal completo de efeitos) — hoje só half-normal.
- Blocagem por confundimento na GERAÇÃO 2^k (Peixoto c3).
- Desirability multi-resposta com teste numérico.
- >2 blocos na análise (dummies múltiplos).

## Arquivos
- `backend/tests/audit/verify_aulas.py` + `fixtures/*.json` (rodável standalone).
- `backend/tests/test_golden_aulas.py` (3 goldens) e `backend/tests/test_blocks_curvature.py` (3 testes dos gaps).
- Motor: `services/stats_service.py` (curvature_test), `services/analysis_service.py` (blocos+curvatura), `domain/analysis.py`/`schemas.py`/`routers/analysis.py` (campo curvature).
- Frontend: `AnovaTable`/`Analysis`/`Report` exibem a curvatura; py-engine re-sincronizado.
- Suíte: **210 testes verdes** (`cd backend && pytest`).

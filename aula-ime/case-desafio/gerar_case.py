# -*- coding: utf-8 -*-
"""Gera o case de encerramento da aula: solo-fibra-cimento com ótimo interior conhecido.

Equipes de 2 a 3 alunos recebem `case-solo-fibra-cimento.csv` (ou o .xlsx) e precisam
achar o teor de cimento e o teor de fibra que maximizam o fck aos 28 dias. Para haver
resposta certa e verificável, o conjunto é gerado a partir de um modelo quadrático
conhecido, côncavo, com máximo dentro da região experimental.

O script é determinístico (semente fixa) e reproduz sempre os mesmos arquivos.
Além de gravar CSV e XLSX, ele verifica os três critérios que tornam o desafio justo:

  1. o ótimo analítico cai dentro de [-1, 1] nos dois eixos codificados;
  2. a diferença de fck entre o ótimo e o melhor ponto fatorial supera três desvios
     do ruído (sem isso o desafio vira sorteio);
  3. ajustando o modelo quadrático completo aos 11 pontos com ruído, o ótimo
     recuperado fica a menos de 0,2 % em cada fator do ótimo verdadeiro.

Rodar (o venv do backend tem statsmodels, pandas e XlsxWriter):

    cd C:\\dev\\iacommurilo\\DoE_programa\\aula-ime\\case-desafio
    ..\\..\\backend\\.venv\\Scripts\\python.exe gerar_case.py

O Python 3.11 do sistema também atende:

    C:\\Users\\Narcísius\\AppData\\Local\\Programs\\Python\\Python311\\python.exe gerar_case.py
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import statsmodels.api as sm

AQUI = Path(__file__).resolve().parent

# ---------------------------------------------------------------------------
# 1. Modelo verdadeiro
# ---------------------------------------------------------------------------
# Em variáveis codificadas z em [-1, 1]:
#   fck = 2.95 + 0.86*z1 + 0.34*z2 - 0.52*z1**2 - 0.61*z2**2 - 0.23*z1*z2
#
# Os dois termos quadráticos negativos garantem concavidade (superfície de máximo);
# a interação desloca o ótimo para longe do centro, de modo que a resposta certa
# não seja simplesmente "o ponto central".

BETA = {
    "b0": 2.95,
    "b1": 0.86,    # z1 = cimento
    "b2": 0.34,    # z2 = fibra
    "b11": -0.52,
    "b22": -0.61,
    "b12": -0.23,
}

# Região experimental declarada aos alunos:
#   cimento de 3 a 9 % em massa ; fibra de 0,25 a 1,75 % em massa.
# Os níveis fatoriais (+-1) ficam DENTRO dessa faixa e os pontos axiais (+-raiz(2))
# vão até perto das bordas, de modo que nenhum ensaio exija dosagem impossível
# (fibra negativa, por exemplo).
CIM_CENTRO, CIM_MEIA = 6.0, 2.0    # fatorial 4,00 e 8,00 ; axial 3,17 e 8,83
FIB_CENTRO, FIB_MEIA = 1.0, 0.5    # fatorial 0,50 e 1,50 ; axial 0,29 e 1,71

ALPHA = math.sqrt(2)               # composição central rotacionável, k = 2
SIGMA = 0.08                       # desvio-padrão do ruído, em MPa
SEMENTE = 20260728
CASAS = 2                          # arredondamento do fck, em MPa

TOL_RELATIVA_PCT = 0.2             # critério 3, leitura relativa
TOL_ABSOLUTA_PP = 0.2              # critério 3, leitura em pontos percentuais


def fck_verdadeiro(z1, z2, b=BETA):
    """Resposta do modelo verdadeiro, sem ruído."""
    return (b["b0"] + b["b1"] * z1 + b["b2"] * z2
            + b["b11"] * z1 ** 2 + b["b22"] * z2 ** 2 + b["b12"] * z1 * z2)


def ponto_estacionario(b):
    """Resolve grad = 0 e devolve (z*, autovalores da matriz de segundas derivadas)."""
    hess = np.array([[2 * b["b11"], b["b12"]],
                     [b["b12"], 2 * b["b22"]]], dtype=float)
    z = np.linalg.solve(hess, [-b["b1"], -b["b2"]])
    return z, np.linalg.eigvalsh(hess)


def para_natural(z1, z2):
    return CIM_CENTRO + CIM_MEIA * z1, FIB_CENTRO + FIB_MEIA * z2


def para_codificado(cimento, fibra):
    return (cimento - CIM_CENTRO) / CIM_MEIA, (fibra - FIB_CENTRO) / FIB_MEIA


# ---------------------------------------------------------------------------
# 2. Composição central rotacionável: 4 fatoriais + 4 axiais + 3 centrais
# ---------------------------------------------------------------------------

def montar_design():
    """Devolve (tipo, z_nominal, natural_arredondado, z_efetivo) por ensaio.

    As coordenadas naturais são arredondadas a 2 casas porque é isso que o
    laboratório consegue dosar; o z efetivo é recalculado a partir delas, para
    que o conjunto entregue aos alunos seja internamente consistente.
    """
    nominais = []
    for s1 in (-1.0, 1.0):
        for s2 in (-1.0, 1.0):
            nominais.append(("fatorial", s1, s2))
    nominais.append(("axial", -ALPHA, 0.0))
    nominais.append(("axial", +ALPHA, 0.0))
    nominais.append(("axial", 0.0, -ALPHA))
    nominais.append(("axial", 0.0, +ALPHA))
    for _ in range(3):
        nominais.append(("central", 0.0, 0.0))

    linhas = []
    for tipo, z1, z2 in nominais:
        cim, fib = para_natural(z1, z2)
        cim, fib = round(cim, 2), round(fib, 2)
        zc1, zc2 = para_codificado(cim, fib)
        linhas.append({"tipo": tipo, "z1_nom": z1, "z2_nom": z2,
                       "cimento": cim, "fibra": fib, "z1": zc1, "z2": zc2})
    return linhas


def matriz_modelo(z1, z2):
    """Modelo quadrático completo: 1, z1, z2, z1^2, z2^2, z1*z2."""
    z1 = np.asarray(z1, float)
    z2 = np.asarray(z2, float)
    return np.column_stack([np.ones_like(z1), z1, z2, z1 ** 2, z2 ** 2, z1 * z2])


# ---------------------------------------------------------------------------
# 3. Geração
# ---------------------------------------------------------------------------

def gerar():
    linhas = montar_design()
    z1 = np.array([r["z1"] for r in linhas])
    z2 = np.array([r["z2"] for r in linhas])

    rng = np.random.default_rng(SEMENTE)
    fck_limpo = fck_verdadeiro(z1, z2)
    fck = np.round(fck_limpo + rng.normal(0.0, SIGMA, len(linhas)), CASAS)

    tabela = pd.DataFrame({
        "Ensaio": np.arange(1, len(linhas) + 1),
        "Cimento_%": [r["cimento"] for r in linhas],
        "Fibra_%": [r["fibra"] for r in linhas],
        "fck_MPa": fck,
    })
    return linhas, tabela, fck_limpo


def gravar(tabela: pd.DataFrame) -> tuple[Path, Path]:
    csv = AQUI / "case-solo-fibra-cimento.csv"
    xlsx = AQUI / "case-solo-fibra-cimento.xlsx"

    # Ponto e vírgula como separador e vírgula decimal: abre direto no Excel em
    # português. As três colunas numéricas saem com 2 casas fixas, para a tabela
    # impressa não misturar "4,0" com "3,17".
    formatada = tabela.copy()
    for coluna in ("Cimento_%", "Fibra_%", "fck_MPa"):
        formatada[coluna] = [f"{v:.2f}".replace(".", ",") for v in tabela[coluna]]
    formatada.to_csv(csv, sep=";", index=False, encoding="utf-8-sig",
                     lineterminator="\r\n")

    # No XLSX os valores continuam numéricos (os alunos vão calcular em cima deles);
    # o que se fixa é o formato de exibição.
    with pd.ExcelWriter(xlsx, engine="xlsxwriter") as wr:
        tabela.to_excel(wr, sheet_name="Ensaios", index=False)
        livro, planilha = wr.book, wr.sheets["Ensaios"]
        duas_casas = livro.add_format({"num_format": "0.00"})
        cabecalho = livro.add_format({"bold": True, "bottom": 1})
        planilha.set_column("A:A", 8)
        planilha.set_column("B:C", 12, duas_casas)
        planilha.set_column("D:D", 11, duas_casas)
        for coluna, nome in enumerate(tabela.columns):
            planilha.write(0, coluna, nome, cabecalho)
    return csv, xlsx


# ---------------------------------------------------------------------------
# 4. Ajuste e verificação
# ---------------------------------------------------------------------------

def ajustar(linhas, fck):
    z1 = np.array([r["z1"] for r in linhas])
    z2 = np.array([r["z2"] for r in linhas])
    modelo = sm.OLS(np.asarray(fck, float), matriz_modelo(z1, z2)).fit()
    b = dict(zip(("b0", "b1", "b2", "b11", "b22", "b12"), modelo.params))
    return modelo, b


def ajustar_sem_interacao(linhas, fck):
    z1 = np.array([r["z1"] for r in linhas])
    z2 = np.array([r["z2"] for r in linhas])
    X = np.column_stack([np.ones_like(z1), z1, z2, z1 ** 2, z2 ** 2])
    m = sm.OLS(np.asarray(fck, float), X).fit()
    b = dict(zip(("b0", "b1", "b2", "b11", "b22"), m.params))
    b["b12"] = 0.0
    return m, b


def linha(rot, valor, largura=52):
    print(f"  {rot:<{largura}} {valor}")


def main() -> int:
    linhas, tabela, fck_limpo = gerar()
    fck = tabela["fck_MPa"].to_numpy()
    csv, xlsx = gravar(tabela)

    z_ver, autov_ver = ponto_estacionario(BETA)
    cim_ver, fib_ver = para_natural(*z_ver)
    fck_ver = fck_verdadeiro(*z_ver)

    modelo, b_hat = ajustar(linhas, fck)
    z_rec, autov_rec = ponto_estacionario(b_hat)
    cim_rec, fib_rec = para_natural(*z_rec)
    fck_rec = fck_verdadeiro(*z_rec)   # fck REAL entregue pelo ponto recuperado

    largura = 78
    print("=" * largura)
    print("CASE DE DESAFIO — SOLO-FIBRA-CIMENTO")
    print("=" * largura)

    print("\n[1] MODELO VERDADEIRO (variáveis codificadas, z em [-1, 1])")
    linha("fck =", f"{BETA['b0']:+.2f} {BETA['b1']:+.2f}·z1 {BETA['b2']:+.2f}·z2 "
                   f"{BETA['b11']:+.2f}·z1² {BETA['b22']:+.2f}·z2² {BETA['b12']:+.2f}·z1·z2")
    linha("z1 (cimento): -1 / +1 correspondem a",
          f"{CIM_CENTRO - CIM_MEIA:.2f} % e {CIM_CENTRO + CIM_MEIA:.2f} %")
    linha("z2 (fibra):   -1 / +1 correspondem a",
          f"{FIB_CENTRO - FIB_MEIA:.2f} % e {FIB_CENTRO + FIB_MEIA:.2f} %")
    linha("ruído gaussiano σ (MPa)", f"{SIGMA}")
    linha("semente", f"numpy.random.default_rng({SEMENTE})")

    print("\n[2] MATRIZ DE ENSAIOS (composição central rotacionável, α = √2)")
    print(f"  {'#':>3} {'tipo':<9} {'Cimento_%':>10} {'Fibra_%':>8} "
          f"{'z1':>8} {'z2':>8} {'fck sem ruído':>14} {'fck_MPa':>9}")
    for i, (r, limpo, obs) in enumerate(zip(linhas, fck_limpo, fck), 1):
        print(f"  {i:3d} {r['tipo']:<9} {r['cimento']:10.2f} {r['fibra']:8.2f} "
              f"{r['z1']:8.4f} {r['z2']:8.4f} {limpo:14.4f} {obs:9.2f}")

    print("\n[3] COEFICIENTES AJUSTADOS (modelo quadrático completo, statsmodels OLS)")
    nomes = ["intercepto", "z1 (cimento)", "z2 (fibra)", "z1²", "z2²", "z1·z2"]
    chaves = ["b0", "b1", "b2", "b11", "b22", "b12"]
    print(f"  {'termo':<14} {'ajustado':>11} {'verdadeiro':>12} {'erro-padrão':>13} "
          f"{'t':>8} {'p':>9}")
    for nome, chave, se, t, p in zip(nomes, chaves, modelo.bse, modelo.tvalues,
                                     modelo.pvalues):
        print(f"  {nome:<14} {b_hat[chave]:11.5f} {BETA[chave]:12.5f} {se:13.5f} "
              f"{t:8.3f} {p:9.5f}")
    linha("R² do ajuste", f"{modelo.rsquared:.6f}")
    linha("R² ajustado", f"{modelo.rsquared_adj:.6f}")
    linha("RMSE (MPa)", f"{math.sqrt(modelo.mse_resid):.6f}")
    linha("graus de liberdade do resíduo", f"{int(modelo.df_resid)}")

    print("\n[4] ÓTIMO")
    print(f"  {'':<22} {'codificado (z1, z2)':>26} {'natural (cimento %, fibra %)':>32}")
    print(f"  {'verdadeiro':<22} {f'({z_ver[0]:.6f}, {z_ver[1]:.6f})':>26} "
          f"{f'({cim_ver:.4f}, {fib_ver:.4f})':>32}")
    print(f"  {'recuperado':<22} {f'({z_rec[0]:.6f}, {z_rec[1]:.6f})':>26} "
          f"{f'({cim_rec:.4f}, {fib_rec:.4f})':>32}")
    linha("fck no ótimo verdadeiro (MPa)", f"{fck_ver:.6f}")
    linha("fck real no ponto recuperado (MPa)", f"{fck_rec:.6f}")
    linha("perda por usar o ponto recuperado (MPa)", f"{fck_ver - fck_rec:.6f}")
    linha("autovalores da Hessiana (verdadeiro)",
          f"{autov_ver[0]:.5f}, {autov_ver[1]:.5f}  "
          f"→ {'máximo' if all(autov_ver < 0) else 'NÃO é máximo'}")
    linha("autovalores da Hessiana (ajustado)",
          f"{autov_rec[0]:.5f}, {autov_rec[1]:.5f}  "
          f"→ {'máximo' if all(autov_rec < 0) else 'NÃO é máximo'}")

    # ---- referências para calibrar a premiação -----------------------------
    m_sem, b_sem = ajustar_sem_interacao(linhas, fck)
    z_sem, _ = ponto_estacionario(b_sem)
    cim_sem, fib_sem = para_natural(*z_sem)
    i_melhor = int(np.argmax(fck))
    print("\n[5] RESPOSTAS DE REFERÊNCIA (para calibrar a faixa de tolerância)")
    print(f"  {'caminho de análise':<44} {'cim %':>7} {'fib %':>7} "
          f"{'e cim':>7} {'e fib':>7} {'fck real':>9} {'perda':>7}")
    for rot, c, f in (
        ("ótimo verdadeiro", cim_ver, fib_ver),
        ("quadrático completo (esperado das equipes)", cim_rec, fib_rec),
        ("quadrático sem o termo de interação", cim_sem, fib_sem),
        ("melhor ensaio observado (sem ajustar modelo)",
         float(tabela["Cimento_%"][i_melhor]), float(tabela["Fibra_%"][i_melhor])),
        ("ponto central (chute ingênuo)", CIM_CENTRO, FIB_CENTRO),
    ):
        real = fck_verdadeiro(*para_codificado(c, f))
        print(f"  {rot:<44} {c:7.4f} {f:7.4f} {abs(c - cim_ver):7.4f} "
              f"{abs(f - fib_ver):7.4f} {real:9.4f} {fck_ver - real:7.4f}")
    print("  ('fck real' = resposta do modelo VERDADEIRO no ponto respondido; "
          "'perda' = quanto se deixa na mesa)")
    print("  Critério de desempate na premiação: maior 'fck real'. "
          "Ele ordena as equipes sem ambiguidade.")

    # ---- critérios --------------------------------------------------------
    print("\n[6] VERIFICAÇÃO DOS TRÊS CRITÉRIOS")
    falhas: list[str] = []

    dentro = bool(np.all(np.abs(z_ver) <= 1.0)) and bool(np.all(autov_ver < 0))
    print(f"  (1) ótimo interior e de máximo")
    print(f"      |z1*| = {abs(z_ver[0]):.6f} ≤ 1 e |z2*| = {abs(z_ver[1]):.6f} ≤ 1, "
          f"Hessiana definida negativa")
    print(f"      → {'ATENDE' if dentro else 'NÃO ATENDE'}")
    if not dentro:
        falhas.append("o ótimo verdadeiro não é um máximo interior")

    fat = [fck_verdadeiro(r["z1"], r["z2"]) for r in linhas if r["tipo"] == "fatorial"]
    todos = [fck_verdadeiro(r["z1"], r["z2"]) for r in linhas]
    delta_fat = fck_ver - max(fat)
    delta_design = fck_ver - max(todos)
    sep = delta_fat > 3 * SIGMA
    print(f"\n  (2) separação acima do ruído")
    print(f"      fck no ótimo                 = {fck_ver:.4f} MPa")
    print(f"      melhor ponto fatorial        = {max(fat):.4f} MPa  "
          f"(Δ = {delta_fat:.4f} MPa)")
    print(f"      3σ                           = {3 * SIGMA:.4f} MPa")
    print(f"      → {'ATENDE' if sep else 'NÃO ATENDE'} "
          f"(margem de {delta_fat / (3 * SIGMA):.2f}×)")
    print(f"      [informativo] melhor ponto do design inteiro = {max(todos):.4f} MPa "
          f"(Δ = {delta_design:.4f} MPa, axial)")
    if not sep:
        falhas.append("a diferença até o melhor ponto fatorial não supera 3σ")

    err_pp = (abs(cim_rec - cim_ver), abs(fib_rec - fib_ver))
    err_pct = (err_pp[0] / cim_ver * 100, err_pp[1] / fib_ver * 100)
    ok_pp = max(err_pp) < TOL_ABSOLUTA_PP
    ok_pct = max(err_pct) < TOL_RELATIVA_PCT
    print(f"\n  (3) recuperação do ótimo pelo ajuste aos 11 pontos")
    print(f"      cimento: verdadeiro {cim_ver:.4f} %, recuperado {cim_rec:.4f} % "
          f"→ {err_pp[0]:.4f} p.p. ({err_pct[0]:.4f} % relativo)")
    print(f"      fibra:   verdadeiro {fib_ver:.4f} %, recuperado {fib_rec:.4f} % "
          f"→ {err_pp[1]:.4f} p.p. ({err_pct[1]:.4f} % relativo)")
    print(f"      leitura em pontos percentuais (< {TOL_ABSOLUTA_PP} p.p. em cada fator): "
          f"{'ATENDE' if ok_pp else 'NÃO ATENDE'}")
    print(f"      leitura relativa (< {TOL_RELATIVA_PCT} % do valor ótimo): "
          f"{'ATENDE' if ok_pct else 'NÃO ATENDE'}")
    if not ok_pp:
        falhas.append("o ótimo recuperado erra mais de 0,2 p.p. em algum fator")
    if not ok_pct:
        print(f"      OBS: a leitura relativa exigiria erro < {0.002 * cim_ver:.4f} p.p. "
              f"no cimento e < {0.002 * fib_ver:.4f} p.p. na fibra. Com fck gravado a "
              f"{CASAS} casas,")
        print(f"           só a quantização do arredondamento (±0,005 MPa) já produz erro "
              f"dessa ordem, mesmo com σ → 0. O critério que separa uma equipe que ajustou")
        print(f"           a superfície de uma que chutou é o de pontos percentuais, e é "
              f"ele que vale na premiação.")

    print("\n[7] ARQUIVOS GRAVADOS")
    linha("CSV (';' como separador, ',' decimal)", str(csv))
    linha("XLSX", str(xlsx))

    print("\n" + "=" * largura)
    if falhas:
        print("CASE REPROVADO:")
        for f in falhas:
            print(" -", f)
        return 1
    print("CASE APROVADO: ótimo interior, separação acima do ruído e recuperável "
          "pelo ajuste.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

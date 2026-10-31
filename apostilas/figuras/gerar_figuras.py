# -*- coding: utf-8 -*-
"""
Gerador das figuras com dado das apostilas de Planejamento de Experimentos.

Regras que este arquivo obedece, e que não devem ser afrouxadas:

1. Todo número vem de `apostilas/dados/numeros.md` (ou, nas três exceções
   marcadas com FORA-DO-BANCO, da fonte primária citada no próprio bloco).
   Nada é inventado. As erratas listadas em `numeros.md` não são propagadas.
2. Preto e branco, com uma única cor de apoio: azul `#1B4E79`. O azul só entra
   quando há duas séries a distinguir, ou para marcar o elemento que a figura
   quer ensinar. Figura de série única sai preta.
3. Superfície e contorno em escala de cinza. Nada de mapa de cor colorido.
4. Fonte serifada (Times New Roman), para casar com o `newtxtext` da classe
   `doeapostila`. Vírgula decimal nos rótulos, em português.
5. Saída em PDF vetorial, um arquivo por figura, com o tamanho físico final
   já embutido: cada figura é gerada na largura exata em que será impressa,
   de modo que `\\includegraphics[width=F\\linewidth]` com o F recomendado
   em CATALOGO.md a coloque em escala 1:1.

Uso:
    C:\\Users\\Narcisius\\AppData\\Local\\Programs\\Python\\Python311\\python.exe gerar_figuras.py
"""

from __future__ import annotations

import math
from pathlib import Path

import fitz  # PyMuPDF, só para medir o PDF gerado
import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import scienceplots  # noqa: F401,E402  (registra os estilos 'science' e 'no-latex')
from matplotlib.ticker import FuncFormatter  # noqa: E402
from mpl_toolkits.mplot3d import Axes3D  # noqa: F401,E402
from scipy import stats  # noqa: E402

# --------------------------------------------------------------------------
# 1. Estilo comum. Definido UMA vez; todas as figuras herdam daqui.
# --------------------------------------------------------------------------

plt.style.use(["science", "no-latex"])

PRETO = "#000000"
AZUL = "#1B4E79"
CINZA = "0.55"
CINZA_CLARO = "0.80"
CINZA_GRADE = "0.90"

plt.rcParams.update(
    {
        "font.family": "serif",
        "font.serif": ["Times New Roman", "DejaVu Serif"],
        "mathtext.fontset": "stix",
        "font.size": 9,
        "axes.titlesize": 9,
        "axes.labelsize": 9,
        "xtick.labelsize": 8,
        "ytick.labelsize": 8,
        "legend.fontsize": 8,
        "legend.frameon": False,
        "axes.prop_cycle": plt.cycler(color=[PRETO, AZUL]),
        "axes.edgecolor": PRETO,
        "axes.labelcolor": PRETO,
        "axes.titlecolor": PRETO,
        "text.color": PRETO,
        "xtick.color": PRETO,
        "ytick.color": PRETO,
        "axes.grid": False,
        "axes.unicode_minus": False,  # Times New Roman não tem U+2212
        "lines.linewidth": 1.0,
        "lines.markersize": 3.6,
        "lines.markeredgewidth": 0.8,
        "pdf.fonttype": 42,  # TrueType embutida, não Type 3
        "pdf.compression": 6,
        "figure.facecolor": "white",
        "axes.facecolor": "white",
        "savefig.facecolor": "white",
        "savefig.transparent": False,
    }
)

RAIZ = Path(__file__).resolve().parent
OUT = RAIZ / "out"
OUT.mkdir(parents=True, exist_ok=True)

# Largura útil de texto da classe `doeapostila`: A4 (21 cm) menos margens
# esquerda e direita de 2,7 cm cada.
LINEWIDTH_CM = 21.0 - 2.7 - 2.7
LINEWIDTH_POL = LINEWIDTH_CM / 2.54  # 6,1417 pol

L_INTEIRA = LINEWIDTH_POL  # 1,00 \linewidth
L_LARGA = 0.80 * LINEWIDTH_POL  # 0,80 \linewidth
L_MEDIA = 0.75 * LINEWIDTH_POL  # 0,75 \linewidth
L_ESTREITA = 0.70 * LINEWIDTH_POL  # 0,70 \linewidth

_REGISTRO: list[tuple[str, float, float]] = []


def virgula(x, _pos=None) -> str:
    """Formata número com vírgula decimal, sem zeros finais inúteis."""
    s = f"{x:g}"
    return s.replace(".", ",")


FMT_VIRGULA = FuncFormatter(virgula)


def fmt_ptbr(ax, eixo: str = "both") -> None:
    if eixo in ("x", "both"):
        ax.xaxis.set_major_formatter(FMT_VIRGULA)
    if eixo in ("y", "both"):
        ax.yaxis.set_major_formatter(FMT_VIRGULA)


def grade(ax, eixo: str = "both") -> None:
    """Grade discreta, em cinza claro. Nunca colorida."""
    ax.grid(True, axis=eixo, color=CINZA_GRADE, linewidth=0.4, zorder=0)
    ax.set_axisbelow(True)


def nova(largura: float, altura: float, **kwargs):
    return plt.figure(figsize=(largura, altura), layout="constrained", **kwargs)


def salvar(fig, nome: str) -> None:
    caminho = OUT / f"{nome}.pdf"
    fig.savefig(caminho)
    plt.close(fig)
    # O estilo `science` traz `savefig.bbox: tight`, de modo que o PDF sai
    # menor do que o `figsize` declarado. A fração recomendada precisa vir
    # da medida real do arquivo, não do tamanho pedido, senão a figura
    # entra na página numa escala diferente da projetada.
    pagina = fitz.open(caminho)[0].rect
    largura, altura = pagina.width / 72.0, pagina.height / 72.0
    fracao = largura / LINEWIDTH_POL
    _REGISTRO.append((nome, largura, altura))
    print(
        f"  [ok] {nome}.pdf  {largura:.2f} x {altura:.2f} pol"
        f"   ->  width={fracao:.2f}\\linewidth"
    )


def conferir(rotulo: str, obtido: float, esperado: float, tol: float = 5e-4) -> None:
    """Confronta o valor recomputado com o valor publicado em numeros.md."""
    ok = abs(obtido - esperado) <= tol * max(1.0, abs(esperado))
    marca = "ok" if ok else "DIVERGE"
    print(f"       [{marca}] {rotulo}: recomputado {obtido:.6f} / banco {esperado:.6f}")
    if not ok:
        raise SystemExit(f"Divergência bloqueante em {rotulo}")


# --------------------------------------------------------------------------
# 2. Dados. Cada bloco declara a chave de `numeros.md` de onde saiu.
# --------------------------------------------------------------------------

# --- `peixoto-2x3` (numeros.md, conjunto 2) -------------------------------
# 2^3 completo, 2 réplicas. Médias por ensaio, na ordem (x1=T, x2=Cat, x3=Conc).
P2X3_MEDIAS = {
    (-1, -1, -1): 54.0,
    (+1, -1, -1): 86.5,
    (-1, +1, -1): 48.0,
    (+1, +1, -1): 63.0,
    (-1, -1, +1): 63.0,
    (+1, -1, +1): 93.5,
    (-1, +1, +1): 58.5,
    (+1, +1, +1): 72.0,
}

# --- `peixoto-2a4` (numeros.md, conjunto 3) -------------------------------
# 2^4 completo, sem réplica. Efeitos exatos; E1 = -2,375 (não o -2,3 impresso).
P2A4_EFEITOS = {
    "1": -2.375,
    "2": 109.375,
    "3": 54.375,
    "4": 67.125,
    "12": -1.125,
    "13": 2.875,
    "14": 1.125,
    "23": 25.625,
    "24": 21.875,
    "34": 9.875,
    "123": 2.625,
    "124": -2.625,
    "134": 5.375,
    "234": 0.125,
    "1234": -8.875,
}

# --- `peixoto-lin-quad` (numeros.md, conjunto 5) --------------------------
PLQ_X = np.array([30, 35, 40, 45, 50, 55, 60, 65, 70], dtype=float)
PLQ_R1 = np.array([24, 40, 60, 70, 77, 86, 91, 86, 84], dtype=float)
PLQ_R2 = np.array([20, 43, 57, 72, 80, 89, 88, 89, 80], dtype=float)

# --- `peixoto-potencia` (numeros.md, conjunto 6) --------------------------
# Coluna da p. 22 (a p. 21 traz outra coluna `v`: discrepância D, não usar).
# O cabeçalho da fonte escreve ln, mas os números são log decimal (errata E).
PP_X = np.array(
    [
        0.000000, 0.698970, 0.954243, 1.113943, 1.230449, 1.322219,
        1.397940, 1.462398, 1.518514, 1.568202, 1.612784, 1.653213,
        1.690196, 1.724276, 1.755875, 1.785330, 1.812913, 1.838849,
    ]
)
PP_Y = np.array(
    [
        0.602060, 0.857332, 0.963788, 1.025306, 1.071882, 1.107210,
        1.139879, 1.164353, 1.187521, 1.206826, 1.225309, 1.240549,
        1.255273, 1.269513, 1.281033, 1.294466, 1.305351, 1.315970,
    ]
)

# --- `origin-2x2` (numeros.md, conjunto 7) --------------------------------
# Dados brutos não impressos na fonte: só as saídas do painel podem ser usadas.
O2X2_TERMOS = ["Cement", "Fiber"]
O2X2_T = [-1.57044, 0.38139]
O2X2_TCRIT = 2.570582  # 5 GL, 95 %

# --- `aula-statistica` (numeros.md, conjunto 9) ---------------------------
AST_TERMOS = ["Tensão Desvio", "Umidade", "Tensão Desvio × Umidade"]
AST_T = [4.606128, 2.807358, 0.778493]
AST_TCRIT = 2.776445  # 4 GL, 95 % (mesmo t* de numeros.md, conjunto 4)

# --- `armaradar` (numeros.md, conjunto 11) --------------------------------
AR_FAB = np.array([1, 2, 3, 4, 5])
AR_C1 = np.array([377.0, 385.0, 407.0, 483.0, 505.0])
AR_C2 = np.array([362.0, 369.0, 410.0, 470.0, 489.0])
AR_DIF = 11.4
AR_SEM_BLOCO = 84.9054  # errata F: a fonte imprime 84,1; o correto e 84,91
AR_COM_BLOCO = 10.1102

# --- FORA-DO-BANCO 1 ------------------------------------------------------
# 20 tiros, velocidade de boca, contra a especificação de projeto de 850 m/s.
# Fonte primária: `contexto aulas/prof PEIXOTO/Capitulos 1 e 2.pdf`, p. 10.
# Transcrito da fonte: este conjunto não consta de `numeros.md`.
TIRO_V = np.array(
    [
        827.1, 850.8, 820.6, 779.9, 861.5, 713.5, 837.2, 825.0, 909.7, 774.0,
        943.3, 859.6, 784.1, 896.5, 807.1, 844.8, 864.9, 876.5, 773.0, 830.2,
    ]
)
TIRO_ESPEC = 850.0

# --- FORA-DO-BANCO 2 ------------------------------------------------------
# Plano 2^2 com ponto central, unidades naturais.
# Fonte primária: `contexto aulas/Cap4_Planejamento_Experimentos_Parte2.pdf`,
# p. 19-21. Concentração de catalisador 10 a 20; temperatura 20 a 50.
# Usado apenas pela figura TikZ `c4-grade-2a2-ponto-central`.

# --- Case do desafio (aula-ime/case-desafio/GABARITO.md, seção 1) ---------
# Modelo verdadeiro, em variáveis codificadas z em [-1, 1].
CASE_B = dict(b0=2.95, b1=0.86, b2=0.34, b11=-0.52, b22=-0.61, b12=-0.23)
CASE_OTIMO_Z = (0.798585, 0.128136)
CASE_OTIMO_NAT = (7.5972, 1.0641)
CASE_OTIMO_FCK = 3.315175
# 11 ensaios entregues (GABARITO, seção 2): cimento %, fibra %, tipo.
CASE_PONTOS = [
    (4.00, 0.50, "fatorial"),
    (4.00, 1.50, "fatorial"),
    (8.00, 0.50, "fatorial"),
    (8.00, 1.50, "fatorial"),
    (3.17, 1.00, "axial"),
    (8.83, 1.00, "axial"),
    (6.00, 0.29, "axial"),
    (6.00, 1.71, "axial"),
    (6.00, 1.00, "central"),
    (6.00, 1.00, "central"),
    (6.00, 1.00, "central"),
]
CASE_MELHOR_ENSAIO = (8.83, 1.00, 3.1257)  # ensaio 6, o melhor de fato realizado


def case_fck(z1, z2):
    b = CASE_B
    return (
        b["b0"]
        + b["b1"] * z1
        + b["b2"] * z2
        + b["b11"] * z1**2
        + b["b22"] * z2**2
        + b["b12"] * z1 * z2
    )


def case_plano(z1, z2):
    """So os termos de primeira ordem do mesmo modelo: a superfície plana."""
    b = CASE_B
    return b["b0"] + b["b1"] * z1 + b["b2"] * z2


def cim_para_z(c):
    return (c - 6.0) / 2.0


def fib_para_z(f):
    return (f - 1.0) / 0.5


# --------------------------------------------------------------------------
# 3. Caderno 1 — Por que planejar experimentos
# --------------------------------------------------------------------------


def fig_um_fator_por_vez() -> None:
    """Contorno sintético: a busca um fator por vez estaciona fora do ótimo."""
    # Superfície sintética (o plano declara "superfície sintética"): quadrática
    # concava com interação forte, ótimo em (7, 6).
    a_ot, b_ot, k = 7.0, 6.0, 5.2

    def resp(x1, x2):
        a, b = x1 - a_ot, x2 - b_ot
        return 100.0 - 3.0 * a**2 - 3.0 * b**2 - k * a * b

    x1 = np.linspace(1.0, 11.0, 400)
    x2 = np.linspace(2.0, 11.0, 400)
    X1, X2 = np.meshgrid(x1, x2)
    Y = resp(X1, X2)

    # Caminho um-fator-por-vez a partir de (2, 9): otimiza x1, depois x2, ...
    p = [(2.0, 9.0)]
    cx1, cx2 = p[0]
    for i in range(4):
        if i % 2 == 0:
            cx1 = a_ot - (k / 6.0) * (cx2 - b_ot)
        else:
            cx2 = b_ot - (k / 6.0) * (cx1 - a_ot)
        p.append((cx1, cx2))
    px = [q[0] for q in p]
    py = [q[1] for q in p]

    fig = nova(L_LARGA, 0.86 * L_LARGA)
    ax = fig.add_subplot(111)

    niveis = [-60.0, -20.0, 20.0, 55.0, 78.0, 90.0, 96.0, 99.0]
    cs = ax.contour(X1, X2, Y, levels=niveis, colors=CINZA, linewidths=0.6)
    ax.clabel(cs, inline=True, fontsize=6.5, fmt=lambda v: virgula(round(v)))

    ax.plot(px, py, color=AZUL, linewidth=1.4, zorder=4, solid_capstyle="round")
    for i in range(len(px) - 1):
        ax.annotate(
            "",
            xy=(px[i + 1], py[i + 1]),
            xytext=(px[i], py[i]),
            arrowprops=dict(arrowstyle="-|>", color=AZUL, lw=1.4, shrinkA=0, shrinkB=0),
            zorder=5,
        )
    ax.plot(px, py, "o", color=AZUL, markersize=3.4, zorder=6)

    ax.plot(a_ot, b_ot, marker="*", color=PRETO, markersize=11, zorder=7, linestyle="")
    ax.annotate(
        "ótimo verdadeiro",
        xy=(a_ot, b_ot),
        xytext=(a_ot + 0.35, b_ot - 1.35),
        fontsize=8,
        arrowprops=dict(arrowstyle="-", color=PRETO, lw=0.6),
    )
    ax.annotate(
        "início",
        xy=(px[0], py[0]),
        xytext=(px[0] - 0.5, py[0] + 0.55),
        fontsize=8,
        color=AZUL,
    )
    ax.annotate(
        "parada após\num ciclo completo",
        xy=(px[2], py[2]),
        xytext=(px[2] - 1.7, py[2] - 2.6),
        fontsize=8,
        color=AZUL,
        ha="left",
        arrowprops=dict(arrowstyle="-|>", color=AZUL, lw=0.7),
    )

    y_ciclo = resp(px[2], py[2])
    ax.text(
        0.985,
        0.03,
        f"resposta na parada: {virgula(round(y_ciclo, 1))}"
        f"   contra {virgula(100)} no ótimo",
        transform=ax.transAxes,
        fontsize=7.5,
        ha="right",
        va="bottom",
        bbox=dict(boxstyle="square,pad=0.3", facecolor="white", edgecolor=CINZA_CLARO, lw=0.5),
    )

    ax.set_xlabel("Fator A (unidades arbitrárias)")
    ax.set_ylabel("Fator B (unidades arbitrárias)")
    ax.set_xlim(1.0, 11.0)
    ax.set_ylim(2.0, 11.0)
    fmt_ptbr(ax)
    salvar(fig, "c1-um-fator-por-vez")


def fig_dispersao_20_medidas() -> None:
    """20 velocidades de boca contra a especificação de 850 m/s."""
    n = TIRO_V.size
    media = TIRO_V.mean()
    s = TIRO_V.std(ddof=1)
    idx = np.arange(1, n + 1)

    fig = nova(L_INTEIRA, 0.40 * L_INTEIRA)
    eixos = fig.subplots(1, 2, width_ratios=[2.6, 1.0], sharey=True)

    ax = eixos[0]
    ax.axhspan(media - s, media + s, color=CINZA_GRADE, zorder=0)
    ax.axhline(media, color=PRETO, linestyle="--", linewidth=0.8, zorder=2)
    ax.axhline(TIRO_ESPEC, color=AZUL, linestyle="-", linewidth=1.2, zorder=3)
    ax.vlines(idx, media, TIRO_V, color=CINZA, linewidth=0.6, zorder=3)
    ax.plot(idx, TIRO_V, "o", color=PRETO, markersize=3.4, zorder=4)
    ax.set_xlabel("tiro")
    ax.set_ylabel("velocidade de boca (m/s)")
    ax.set_xlim(0.2, n + 0.8)
    ax.set_xticks([1, 5, 10, 15, 20])
    ax.annotate(
        "especificação de projeto: 850 m/s",
        xy=(7.0, TIRO_ESPEC),
        xytext=(3.2, 935),
        color=AZUL,
        fontsize=7.5,
        ha="left",
        va="center",
        arrowprops=dict(arrowstyle="-", color=AZUL, lw=0.6),
    )
    ax.text(
        0.8,
        media,
        f" média {virgula(round(media, 1))}",
        color=PRETO,
        fontsize=7.5,
        va="bottom",
        ha="left",
    )
    ax.set_ylim(695, 965)

    ax2 = eixos[1]
    bins = np.arange(700, 981, 35.0)
    ax2.hist(
        TIRO_V,
        bins=bins,
        orientation="horizontal",
        color=CINZA_CLARO,
        edgecolor=PRETO,
        linewidth=0.6,
    )
    ax2.axhline(TIRO_ESPEC, color=AZUL, linewidth=1.2)
    ax2.axhline(media, color=PRETO, linestyle="--", linewidth=0.8)
    ax2.set_xlabel("tiros")
    ax2.set_xticks([0, 2, 4, 6])
    ax2.text(
        0.95,
        0.96,
        f"s = {virgula(round(s, 1))} m/s",
        transform=ax2.transAxes,
        fontsize=7.5,
        ha="right",
        va="top",
    )

    for a in eixos:
        fmt_ptbr(a)
    salvar(fig, "c1-dispersao-20-medidas")


def fig_blocagem_intervalo() -> None:
    """armaradar: os mesmos dez números, com e sem reconhecer o bloco."""
    fig = nova(L_INTEIRA, 0.42 * L_INTEIRA)
    eixos = fig.subplots(1, 2, width_ratios=[1.0, 1.25])

    ax = eixos[0]
    ax.vlines(AR_FAB, AR_C2, AR_C1, color=CINZA, linewidth=0.8, zorder=2)
    ax.plot(AR_FAB, AR_C1, "o", color=PRETO, markersize=4.2, zorder=3, label="conjunto 1")
    ax.plot(
        AR_FAB,
        AR_C2,
        "s",
        color=AZUL,
        markerfacecolor="white",
        markersize=4.2,
        zorder=3,
        label="conjunto 2",
    )
    ax.set_xlabel("fabricante da munição (bloco)")
    ax.set_ylabel("velocidade (m/s)")
    ax.set_xticks(AR_FAB)
    ax.set_xlim(0.4, 6.1)
    ax.set_ylim(348, 522)
    ax.legend(loc="upper left", handletextpad=0.4, borderpad=0.2)
    ax.annotate(
        "",
        xy=(5.72, 505),
        xytext=(5.72, 377),
        arrowprops=dict(arrowstyle="<->", color=CINZA, lw=0.7),
    )
    ax.text(
        5.62,
        441,
        "variação entre\nfabricantes",
        fontsize=7,
        color=CINZA,
        rotation=90,
        va="center",
        ha="center",
    )
    ax.set_title("(a) os dez valores originais", fontsize=8.5)
    grade(ax, "y")

    ax2 = eixos[1]
    posicoes = [1.0, 0.0]
    semis = [AR_SEM_BLOCO, AR_COM_BLOCO]
    cores = [PRETO, AZUL]
    rotulos = ["sem blocagem\n(2 amostras, 8 GL)", "com blocagem\n(pareado, 4 GL)"]
    ax2.axvline(0.0, color=CINZA, linewidth=0.8, linestyle="--", zorder=1)
    for pos, semi, cor in zip(posicoes, semis, cores):
        ax2.errorbar(
            AR_DIF,
            pos,
            xerr=semi,
            fmt="o",
            color=cor,
            markersize=4.2,
            capsize=3.2,
            elinewidth=1.1,
            capthick=1.1,
            zorder=3,
        )
        ax2.text(
            AR_DIF,
            pos + 0.16,
            f"{virgula(AR_DIF)} $\\pm$ {virgula(round(semi, 2))}",
            fontsize=7.5,
            ha="center",
            color=cor,
        )
    ax2.set_yticks(posicoes)
    ax2.set_yticklabels(rotulos, fontsize=7.5)
    ax2.set_ylim(-0.55, 1.5)
    ax2.set_xlabel("diferença média entre os conjuntos (m/s)")
    ax2.text(
        0.0,
        -0.42,
        " zero",
        fontsize=7.5,
        color=CINZA,
        ha="left",
        va="center",
    )
    ax2.set_title("(b) intervalo de 95 % para a diferença", fontsize=8.5)
    fmt_ptbr(ax2, "x")
    salvar(fig, "c1-blocagem-intervalo")


def fig_variancia_da_media() -> None:
    """Var(x-barra) = sigma^2/N: o retorno decrescente da réplica."""
    n = np.arange(1, 21)
    var = 1.0 / n
    dp = 1.0 / np.sqrt(n)

    fig = nova(L_ESTREITA, 0.78 * L_ESTREITA)
    ax = fig.add_subplot(111)
    grade(ax)
    ax.plot(n, var, "-o", color=PRETO, markersize=3.2, label=r"$\mathrm{Var}(\bar{x})/\sigma^{2} = 1/N$")
    ax.plot(
        n,
        dp,
        "-s",
        color=AZUL,
        markerfacecolor="white",
        markersize=3.2,
        label=r"$\mathrm{DP}(\bar{x})/\sigma = 1/\sqrt{N}$",
    )

    for alvo in (2, 4, 9, 16):
        ax.plot([alvo, alvo], [0, var[alvo - 1]], color=CINZA_CLARO, linewidth=0.6, zorder=1)
        ax.text(
            alvo,
            var[alvo - 1] - 0.035,
            virgula(round(var[alvo - 1], 3)),
            fontsize=7,
            ha="center",
            va="top",
            color=PRETO,
        )

    ax.annotate(
        "quartear a variância\ncusta quatro vezes\nmais corpos de prova",
        xy=(4, 0.25),
        xytext=(7.2, 0.62),
        fontsize=7.5,
        arrowprops=dict(arrowstyle="-|>", color=PRETO, lw=0.7),
    )
    ax.set_xlabel("N, número de réplicas")
    ax.set_ylabel("fração do valor com uma única medida")
    ax.set_xlim(0.4, 20.6)
    ax.set_ylim(0.0, 1.12)
    ax.set_xticks([1, 4, 8, 12, 16, 20])
    ax.legend(loc="upper right", handletextpad=0.4)
    fmt_ptbr(ax, "y")
    salvar(fig, "c1-variancia-da-media")


# --------------------------------------------------------------------------
# 4. Caderno 2 — Planejamento fatorial 2^k
# --------------------------------------------------------------------------


def _media_por(sinal_idx: int, valor: int, fixo_idx: int, fixo: int) -> float:
    vals = [
        v
        for chave, v in P2X3_MEDIAS.items()
        if chave[sinal_idx] == valor and chave[fixo_idx] == fixo
    ]
    return float(np.mean(vals))


def fig_interacao() -> None:
    """Gráfico de interação: com interação (T x Cat) e sem (T x Conc)."""
    temp = [313, 333]

    # (a) Temperatura x Catalisador, media sobre concentração.
    cat_a = [
        float(np.mean([P2X3_MEDIAS[(t, -1, c)] for c in (-1, +1)])) for t in (-1, +1)
    ]
    cat_b = [
        float(np.mean([P2X3_MEDIAS[(t, +1, c)] for c in (-1, +1)])) for t in (-1, +1)
    ]
    e_tcat = ((cat_b[1] - cat_b[0]) - (cat_a[1] - cat_a[0])) / 2.0
    conferir("E_T.Cat", e_tcat, -8.625)

    # (b) Temperatura x Concentração, media sobre catalisador.
    con_lo = [
        float(np.mean([P2X3_MEDIAS[(t, c, -1)] for c in (-1, +1)])) for t in (-1, +1)
    ]
    con_hi = [
        float(np.mean([P2X3_MEDIAS[(t, c, +1)] for c in (-1, +1)])) for t in (-1, +1)
    ]
    e_tcon = ((con_hi[1] - con_hi[0]) - (con_lo[1] - con_lo[0])) / 2.0
    conferir("E_T.Conc", e_tcon, -0.875)

    fig = nova(L_INTEIRA, 0.40 * L_INTEIRA)
    eixos = fig.subplots(1, 2, sharey=True)

    for ax, s1, s2, r1, r2, titulo, efeito in (
        (eixos[0], cat_a, cat_b, "catalisador A", "catalisador B",
         "(a) com interação", e_tcat),
        (eixos[1], con_lo, con_hi, "concentração 1,0 M", "concentração 1,5 M",
         "(b) sem interação", e_tcon),
    ):
        grade(ax, "y")
        ax.plot(temp, s1, "-o", color=PRETO, markersize=4.2, label=r1)
        ax.plot(
            temp, s2, "--s", color=AZUL, markerfacecolor="white", markersize=4.2, label=r2
        )
        for t, v in zip(temp, s1):
            ax.text(t, v + 1.4, virgula(v), fontsize=7, ha="center", color=PRETO)
        for t, v in zip(temp, s2):
            ax.text(t, v - 3.6, virgula(v), fontsize=7, ha="center", color=AZUL)
        ax.set_xlabel("temperatura (K)")
        ax.set_xticks(temp)
        ax.set_xlim(308, 338)
        ax.set_title(titulo, fontsize=8.5)
        ax.legend(loc="upper left", handletextpad=0.5)
        ax.text(
            0.97,
            0.04,
            f"efeito de interação = {virgula(round(efeito, 3))}",
            transform=ax.transAxes,
            fontsize=7.5,
            ha="right",
            va="bottom",
        )
        fmt_ptbr(ax, "y")

    eixos[0].set_ylabel("rendimento médio (%)")
    eixos[0].set_ylim(42, 100)
    salvar(fig, "c2-interacao")


def _painel_pareto(ax, termos, ts, tcrit, titulo, nota) -> None:
    ordem = np.argsort(np.abs(ts))
    rot = [termos[i] for i in ordem]
    val = [abs(ts[i]) for i in ordem]
    pos = np.arange(len(val))
    for p, v in zip(pos, val):
        signif = v >= tcrit
        ax.barh(
            p,
            v,
            height=0.55,
            color=AZUL if signif else CINZA_CLARO,
            edgecolor=AZUL if signif else PRETO,
            linewidth=0.7,
            zorder=3,
        )
        ax.text(
            v + 0.09,
            p,
            virgula(round(v, 3)),
            fontsize=7,
            va="center",
            color=AZUL if signif else PRETO,
        )
    ax.axvline(tcrit, color=PRETO, linestyle="--", linewidth=1.0, zorder=4)
    ax.text(
        tcrit,
        len(val) - 0.30,
        f"  t crítico = {virgula(round(tcrit, 3))}",
        fontsize=7.5,
        va="center",
        ha="left",
    )
    ax.set_yticks(pos)
    ax.set_yticklabels(rot, fontsize=7.5)
    ax.set_xlabel("efeito padronizado, $|t|$")
    ax.set_xlim(0, max(max(val), tcrit) * 1.42)
    ax.set_ylim(-0.6, len(val) - 0.05)
    ax.set_title(titulo, fontsize=8.5)
    ax.text(
        0.98,
        0.05,
        nota,
        transform=ax.transAxes,
        fontsize=7.5,
        ha="right",
        va="bottom",
        bbox=dict(boxstyle="square,pad=0.2", facecolor="white", edgecolor="none"),
    )
    grade(ax, "x")
    fmt_ptbr(ax, "x")


def fig_pareto_efeitos() -> None:
    """Pareto dos efeitos padronizados, com a linha critica."""
    fig = nova(L_INTEIRA, 0.36 * L_INTEIRA)
    eixos = fig.subplots(1, 2)
    _painel_pareto(
        eixos[0],
        O2X2_TERMOS,
        O2X2_T,
        O2X2_TCRIT,
        "(a) nenhum efeito se destaca do ruído",
        "$R^{2}$ = 0,34312",
    )
    _painel_pareto(
        eixos[1],
        AST_TERMOS,
        AST_T,
        AST_TCRIT,
        "(b) dois efeitos ultrapassam a linha",
        "$R^{2}$ = 0,88132",
    )
    salvar(fig, "c2-pareto-efeitos")


def fig_normal_efeitos() -> None:
    """Gráfico normal dos efeitos, caso sem réplica (2^4 completo)."""
    nomes = list(P2A4_EFEITOS.keys())
    vals = np.array([P2A4_EFEITOS[k] for k in nomes])
    ordem = np.argsort(vals)
    vals_ord = vals[ordem]
    nomes_ord = [nomes[i] for i in ordem]
    n = vals.size
    p = (np.arange(1, n + 1) - 0.5) / n
    z = stats.norm.ppf(p)

    destaque = {"2", "3", "4", "23", "24"}

    # Reta de referência ajustada apenas sobre os efeitos que se comportam como
    # ruído. Incluir os cinco grandes achataria a reta e destruiria o diagnóstico.
    nulos = np.array([nome not in destaque for nome in nomes_ord])
    a, b = np.polyfit(vals_ord[nulos], z[nulos], 1)

    fig = nova(L_MEDIA, 0.86 * L_MEDIA)
    ax = fig.add_subplot(111)
    grade(ax)
    xr = np.array([vals_ord.min() - 8.0, (2.30 - b) / a])
    ax.plot(xr, a * xr + b, color=CINZA, linewidth=0.8, zorder=2)

    for nome, v, zz in zip(nomes_ord, vals_ord, z):
        e = nome in destaque
        ax.plot(
            v,
            zz,
            marker="o" if e else "o",
            color=AZUL if e else PRETO,
            markerfacecolor=AZUL if e else "white",
            markersize=4.2 if e else 3.4,
            zorder=4,
            linestyle="",
        )
        if e or abs(v) > 8:
            ax.annotate(
                nome,
                xy=(v, zz),
                xytext=(-4 if v > 0 else 6, 5),
                textcoords="offset points",
                fontsize=7.5,
                color=AZUL if e else PRETO,
                ha="right" if v > 0 else "left",
            )

    ax.set_xlabel("efeito estimado")
    ax.set_ylabel("quantil da normal padrão")
    ax.set_xlim(-25, 125)
    ax.set_ylim(-2.4, 2.4)
    ax.text(
        0.03,
        0.95,
        "os efeitos alinhados na reta\nse comportam como ruído",
        transform=ax.transAxes,
        fontsize=7.5,
        va="top",
        ha="left",
    )
    fmt_ptbr(ax)
    salvar(fig, "c2-normal-efeitos")


# --------------------------------------------------------------------------
# 5. Caderno 3 — Regressão e análise de variância
# --------------------------------------------------------------------------


def _ajuste_potencia():
    b1, b0c = np.polyfit(PP_X - PP_X.mean(), PP_Y, 1)
    yhat = b0c + b1 * (PP_X - PP_X.mean())
    res = PP_Y - yhat
    sqr = float(np.sum((yhat - PP_Y.mean()) ** 2))
    sqres = float(np.sum(res**2))
    return b0c, b1, yhat, res, sqr, sqres


def fig_nuvem_reta_residuos() -> None:
    """Nuvem, reta ajustada e resíduos como segmentos verticais."""
    b0c, b1, yhat, res, sqr, sqres = _ajuste_potencia()
    conferir("beta0 (peixoto-potencia)", b0c, 1.139646)
    conferir("beta1 (peixoto-potencia)", b1, 0.391856)
    conferir("SQ_R (peixoto-potencia)", sqr, 0.575784, tol=2e-3)
    conferir("SQ_r (peixoto-potencia)", sqres, 0.000238, tol=2e-2)

    fig = nova(L_INTEIRA, 0.40 * L_INTEIRA)
    eixos = fig.subplots(1, 2, width_ratios=[1.25, 1.0])

    ax = eixos[0]
    grade(ax)
    xr = np.linspace(PP_X.min() - 0.05, PP_X.max() + 0.05, 100)
    ax.plot(xr, b0c + b1 * (xr - PP_X.mean()), color=AZUL, linewidth=1.2, zorder=3)
    ax.vlines(PP_X, yhat, PP_Y, color=PRETO, linewidth=0.9, zorder=4)
    ax.plot(PP_X, PP_Y, "o", color=PRETO, markersize=3.6, zorder=5)
    ax.set_xlabel(r"$x = \log_{10} P$   (P em psi)")
    ax.set_ylabel(r"$y = \log_{10} v$   (v em mm/s)")
    ax.set_title("(a) nuvem e reta ajustada", fontsize=8.5)
    ax.text(
        0.97,
        0.10,
        r"$\hat{y} = 1{,}139646 + 0{,}391856\,(x - \bar{x})$"
        "\n"
        r"$R^{2} = 0{,}999587$",
        transform=ax.transAxes,
        fontsize=7.5,
        ha="right",
        va="bottom",
        color=AZUL,
    )
    fmt_ptbr(ax)

    ax2 = eixos[1]
    grade(ax2)
    ax2.axhline(0.0, color=AZUL, linewidth=1.2, zorder=3)
    ax2.vlines(PP_X, 0.0, res * 1e3, color=PRETO, linewidth=0.9, zorder=4)
    ax2.plot(PP_X, res * 1e3, "o", color=PRETO, markersize=3.6, zorder=5)
    ax2.set_xlabel(r"$x = \log_{10} P$")
    ax2.set_ylabel(r"resíduo $\times 10^{-3}$")
    ax2.set_title("(b) os mesmos segmentos, ampliados", fontsize=8.5)
    ax2.text(
        0.97,
        0.05,
        f"s = {virgula(0.003855)}",
        transform=ax2.transAxes,
        fontsize=7.5,
        ha="right",
        va="bottom",
    )
    fmt_ptbr(ax2)
    salvar(fig, "c3-nuvem-reta-residuos")


def _ajuste_linear_plq():
    x = np.repeat(PLQ_X, 2)
    y = np.empty(x.size)
    y[0::2] = PLQ_R1
    y[1::2] = PLQ_R2
    b1, b0 = np.polyfit(x, y, 1)
    yhat = b0 + b1 * x
    return x, y, b0, b1, yhat, y - yhat


def fig_decomposicao_sq() -> None:
    """SQ_T = SQ_R + SQ_r, no mesmo eixo e em proporção."""
    x, y, b0, b1, yhat, res = _ajuste_linear_plq()
    ybar = y.mean()
    sqt = float(np.sum((y - ybar) ** 2))
    sqr = float(np.sum((yhat - ybar) ** 2))
    sqres = float(np.sum(res**2))
    conferir("beta0 (peixoto-lin-quad linear)", b0, -7.416667)
    conferir("beta1 (peixoto-lin-quad linear)", b1, 1.521667)
    conferir("SQ_T (peixoto-lin-quad)", sqt, 8930.0)
    conferir("SQ_R (peixoto-lin-quad linear)", sqr, 6946.408333)
    conferir("SQ_r (peixoto-lin-quad linear)", sqres, 1983.591667)

    fig = nova(L_INTEIRA, 0.42 * L_INTEIRA)
    eixos = fig.subplots(1, 2, width_ratios=[1.5, 1.0])

    ax = eixos[0]
    grade(ax)
    xr = np.linspace(28, 72, 100)
    ax.axhline(ybar, color=CINZA, linestyle="--", linewidth=0.9, zorder=2)
    ax.plot(xr, b0 + b1 * xr, color=PRETO, linewidth=1.1, zorder=3)
    ax.plot(x, y, "o", color=PRETO, markerfacecolor="white", markersize=3.4, zorder=5)

    escolhidos = [0, 4, 12, 17]
    for k in escolhidos:
        xi, yi, yhi = x[k], y[k], yhat[k]
        ax.vlines(xi, ybar, yhi, color=AZUL, linewidth=2.6, zorder=4, alpha=0.85)
        ax.vlines(xi, yhi, yi, color=PRETO, linewidth=2.6, zorder=4)
        ax.plot(xi, yhi, "s", color=AZUL, markersize=3.4, zorder=6)
    ax.text(
        29.0,
        ybar + 1.6,
        r"$\bar{y}$ = " + virgula(round(ybar, 3)),
        fontsize=7.5,
        color=CINZA,
    )
    ax.annotate(
        r"$\hat{y}_i - \bar{y}$ : explicado",
        xy=(x[12], (ybar + yhat[12]) / 2),
        xytext=(46, 30),
        fontsize=7.5,
        color=AZUL,
        arrowprops=dict(arrowstyle="-|>", color=AZUL, lw=0.7),
    )
    ax.annotate(
        r"$y_i - \hat{y}_i$ : resíduo",
        xy=(x[17], (yhat[17] + y[17]) / 2),
        xytext=(44, 105),
        fontsize=7.5,
        color=PRETO,
        arrowprops=dict(arrowstyle="-|>", color=PRETO, lw=0.7),
    )
    ax.set_xlabel("x")
    ax.set_ylabel("y")
    ax.set_xlim(28, 72)
    ax.set_ylim(10, 118)
    ax.set_title("(a) a decomposição ponto a ponto", fontsize=8.5)
    fmt_ptbr(ax)

    ax2 = eixos[1]
    ax2.barh(0, sqr, height=0.42, color=AZUL, edgecolor=AZUL, zorder=3)
    ax2.barh(0, sqres, left=sqr, height=0.42, color=CINZA_CLARO, edgecolor=PRETO,
             linewidth=0.7, zorder=3)
    ax2.set_yticks([0])
    ax2.set_yticklabels([r"$\mathrm{SQ}_{\mathrm{T}}$"], fontsize=9)
    ax2.set_ylim(-0.75, 0.75)
    ax2.set_xlim(0, sqt * 1.02)
    ax2.set_xlabel("soma de quadrados")
    ax2.text(
        sqr / 2,
        0.30,
        r"$\mathrm{SQ}_{\mathrm{R}}$ = " + virgula(round(sqr, 1)),
        fontsize=7.5,
        ha="center",
        color=AZUL,
    )
    ax2.text(
        sqr + sqres / 2,
        -0.34,
        r"$\mathrm{SQ}_{\mathrm{r}}$ = " + virgula(round(sqres, 1)),
        fontsize=7.5,
        ha="center",
        color=PRETO,
    )
    ax2.text(
        0.5,
        0.86,
        r"$R^{2} = \mathrm{SQ}_{\mathrm{R}}/\mathrm{SQ}_{\mathrm{T}}$ = "
        + virgula(round(sqr / sqt, 6)),
        transform=ax2.transAxes,
        fontsize=8,
        ha="center",
    )
    ax2.set_title("(b) a mesma soma, em proporção", fontsize=8.5)
    grade(ax2, "x")
    fmt_ptbr(ax2, "x")
    salvar(fig, "c3-decomposicao-sq")


def fig_diagnosticos_residuo() -> None:
    """Os quatro diagnosticos de resíduo do modelo linear de peixoto-lin-quad."""
    x, y, b0, b1, yhat, res = _ajuste_linear_plq()
    n = res.size
    # Ordem de ensaio: réplica 1 nos nove níveis, depois réplica 2.
    ordem_res = np.concatenate([res[0::2], res[1::2]])
    ordem_idx = np.arange(1, n + 1)

    fig = nova(L_INTEIRA, 0.72 * L_INTEIRA)
    eixos = fig.subplots(2, 2)

    ax = eixos[0, 0]
    grade(ax)
    ax.axhline(0, color=CINZA, linewidth=0.8, zorder=2)
    ax.plot(yhat, res, "o", color=PRETO, markerfacecolor="white", markersize=3.6, zorder=4)
    ord_h = np.argsort(yhat)
    coef = np.polyfit(yhat, res, 2)
    ax.plot(yhat[ord_h], np.polyval(coef, yhat[ord_h]), color=AZUL, linewidth=1.2, zorder=5)
    ax.set_xlabel("valor ajustado")
    ax.set_ylabel("resíduo")
    ax.set_title("(a) resíduo contra ajustado", fontsize=8.5)
    ax.text(
        0.5,
        0.04,
        "o padrão em U denuncia falta de ajuste",
        transform=ax.transAxes,
        fontsize=7.5,
        ha="center",
        color=AZUL,
    )
    fmt_ptbr(ax)

    ax = eixos[0, 1]
    grade(ax)
    ax.axhline(0, color=CINZA, linewidth=0.8, zorder=2)
    ax.vlines(ordem_idx, 0, ordem_res, color=CINZA_CLARO, linewidth=0.8, zorder=3)
    ax.plot(ordem_idx, ordem_res, "o", color=PRETO, markersize=3.4, zorder=4)
    ax.axvline(9.5, color=PRETO, linestyle=":", linewidth=0.7, zorder=2)
    ax.text(5.0, 21.5, "réplica 1", fontsize=7.5, ha="center")
    ax.text(14.0, 21.5, "réplica 2", fontsize=7.5, ha="center")
    ax.set_xlabel("ordem de ensaio")
    ax.set_ylabel("resíduo")
    ax.set_xticks([1, 5, 9, 13, 18])
    ax.set_ylim(-28, 26)
    ax.set_title("(b) resíduo contra ordem", fontsize=8.5)
    fmt_ptbr(ax)

    ax = eixos[1, 0]
    ax.hist(res, bins=np.arange(-25, 26, 6.25), color=CINZA_CLARO, edgecolor=PRETO,
            linewidth=0.7, zorder=3)
    ax.set_xlabel("resíduo")
    ax.set_ylabel("frequência")
    ax.set_title("(c) histograma dos resíduos", fontsize=8.5)
    grade(ax, "y")
    fmt_ptbr(ax)

    ax = eixos[1, 1]
    grade(ax)
    r_ord = np.sort(res)
    pp = (np.arange(1, n + 1) - 0.5) / n
    zq = stats.norm.ppf(pp)
    ax.plot(zq, r_ord, "o", color=PRETO, markerfacecolor="white", markersize=3.6, zorder=4)
    aa, bb = np.polyfit(zq, r_ord, 1)
    ax.plot(zq, aa * zq + bb, color=CINZA, linewidth=0.9, zorder=3)
    ax.set_xlabel("quantil da normal padrão")
    ax.set_ylabel("resíduo ordenado")
    ax.set_title("(d) probabilidade normal", fontsize=8.5)
    fmt_ptbr(ax)

    salvar(fig, "c3-diagnosticos-residuo")


# --------------------------------------------------------------------------
# 6. Caderno 4 — Curvatura e superfície de resposta
# --------------------------------------------------------------------------


def fig_linear_vs_quadratico() -> None:
    """Os mesmos 18 pontos sob o ajuste linear e sob o quadrático."""
    x, y, b0, b1, yhat_l, _ = _ajuste_linear_plq()
    c2, c1, c0 = np.polyfit(x, y, 2)
    conferir("beta0 (quadrático)", c0, -172.416667)
    conferir("beta1 (quadrático)", c1, 8.593095)
    conferir("beta2 (quadrático)", c2, -0.070714)

    xr = np.linspace(28, 72, 240)

    fig = nova(L_LARGA, 0.72 * L_LARGA)
    ax = fig.add_subplot(111)
    grade(ax)
    ax.plot(
        xr, b0 + b1 * xr, color=PRETO, linestyle="--", linewidth=1.1,
        label="modelo linear", zorder=3,
    )
    ax.plot(
        xr, c0 + c1 * xr + c2 * xr**2, color=AZUL, linewidth=1.4,
        label="modelo quadrático", zorder=4,
    )
    ax.plot(x, y, "o", color=PRETO, markerfacecolor="white", markersize=3.8, zorder=5,
            label="18 observações (2 réplicas)")
    ax.set_xlabel("x")
    ax.set_ylabel("y")
    ax.set_xlim(28, 72)
    ax.set_ylim(10, 108)
    ax.legend(loc="lower right", handletextpad=0.5)
    ax.text(
        0.035,
        0.955,
        "linear:      $R^{2}$ = 0,777873    "
        r"$\mathrm{MQ}_{\mathrm{faj}}/\mathrm{MQ}_{\mathrm{ep}}$ = 55,4"
        "\n"
        "quadrático:  $R^{2}$ = 0,993461    "
        r"$\mathrm{MQ}_{\mathrm{faj}}/\mathrm{MQ}_{\mathrm{ep}}$ = 0,447",
        transform=ax.transAxes,
        fontsize=7.5,
        va="top",
        ha="left",
        linespacing=1.5,
        bbox=dict(boxstyle="square,pad=0.35", facecolor="white", edgecolor=CINZA_CLARO, lw=0.5),
    )
    ax.text(
        0.035,
        0.60,
        "o erro puro é o mesmo nos dois:\n"
        r"$\mathrm{SQ}_{\mathrm{ep}}$ = 45 com 9 GL",
        transform=ax.transAxes,
        fontsize=7.5,
        va="top",
        ha="left",
        linespacing=1.5,
    )
    fmt_ptbr(ax)
    salvar(fig, "c4-linear-vs-quadratico")


def fig_superficie_plana_vs_curva() -> None:
    """Superfície plana e superfície curva, lado a lado (modelo do case)."""
    z = np.linspace(-1.45, 1.45, 41)
    Z1, Z2 = np.meshgrid(z, z)
    Yp = case_plano(Z1, Z2)
    Yc = case_fck(Z1, Z2)
    zmin, zmax = 0.0, 4.4

    fig = plt.figure(figsize=(L_INTEIRA, 0.44 * L_INTEIRA))
    # Posicao explicita: com `subplots` o rotulo do eixo z do painel da direita
    # cai fora da figura e e cortado silenciosamente. As duas faixas abaixo
    # reservam a margem de que o rotulo precisa.
    caixas = ([0.005, 0.00, 0.475, 0.92], [0.455, 0.00, 0.475, 0.92])
    for k, (Y, titulo) in enumerate(
        ((Yp, "(a) modelo de primeira ordem"), (Yc, "(b) modelo com termos quadráticos"))
    ):
        ax = fig.add_axes(caixas[k], projection="3d")
        # Fundo transparente: o rotulo do eixo z do painel (a) cai dentro do
        # retangulo do painel (b), que e desenhado depois e o encobriria.
        ax.patch.set_visible(False)
        ax.plot_surface(
            Z1, Z2, Y, rstride=2, cstride=2, color="0.90", edgecolor="0.42",
            linewidth=0.28, shade=False, antialiased=True,
        )
        ax.contour(Z1, Z2, Y, levels=8, zdir="z", offset=zmin, colors=CINZA, linewidths=0.45)
        ax.set_zlim(zmin, zmax)
        ax.set_xlabel(r"$z_1$ (cimento)", labelpad=-4, fontsize=8)
        ax.set_ylabel(r"$z_2$ (fibra)", labelpad=-4, fontsize=8)
        # O rotulo do eixo z e posto com `fig.text`: `set_zlabel` do mplot3d
        # some no painel da direita quando os eixos são criados com `add_axes`.
        fig.text(
            caixas[k][0] + caixas[k][2] * 0.995, 0.52, "resposta (MPa)",
            fontsize=8, rotation=90, ha="center", va="center",
        )
        ax.tick_params(labelsize=6.5, pad=-1.5)
        ax.set_xticks([-1, 0, 1])
        ax.set_yticks([-1, 0, 1])
        ax.set_zticks([0, 1, 2, 3, 4])
        ax.xaxis.set_major_formatter(FMT_VIRGULA)
        ax.yaxis.set_major_formatter(FMT_VIRGULA)
        ax.zaxis.set_major_formatter(FMT_VIRGULA)
        ax.view_init(elev=24, azim=-56)
        ax.set_box_aspect((1, 1, 0.62))
        fig.text(
            caixas[k][0] + caixas[k][2] / 2.0, 0.955, titulo,
            fontsize=8.5, ha="center", va="center",
        )
        for pane in (ax.xaxis, ax.yaxis, ax.zaxis):
            pane.pane.set_edgecolor(CINZA_CLARO)
            pane.pane.set_facecolor("white")
            pane.pane.set_alpha(1.0)
        ax.grid(False)

    z1o, z2o = CASE_OTIMO_Z
    ax = fig.axes[1]
    ax.plot([z1o], [z2o], [CASE_OTIMO_FCK], marker="*", color=AZUL, markersize=9, zorder=10)
    ax.plot([z1o, z1o], [z2o, z2o], [zmin, CASE_OTIMO_FCK], color=AZUL, linewidth=0.8)
    ax.text(z1o, z2o, CASE_OTIMO_FCK + 0.55, "máximo\ninterior", color=AZUL, fontsize=7.5,
            ha="center")

    salvar(fig, "c4-superficie-plana-vs-curva")


def fig_contorno_otimo() -> None:
    """Contorno do modelo do case, com o ponto ótimo marcado."""
    cim = np.linspace(3.0, 9.0, 320)
    fib = np.linspace(0.25, 1.75, 320)
    C, F = np.meshgrid(cim, fib)
    Y = case_fck(cim_para_z(C), fib_para_z(F))

    fig = nova(L_LARGA, 0.80 * L_LARGA)
    ax = fig.add_subplot(111)
    niveis = [0.5, 1.0, 1.5, 2.0, 2.4, 2.7, 2.9, 3.1, 3.25]
    cs = ax.contour(C, F, Y, levels=niveis, colors=CINZA, linewidths=0.6)
    ax.clabel(cs, inline=True, fontsize=6.5, fmt=lambda v: virgula(round(v, 2)))

    fat = [(c, f) for c, f, t in CASE_PONTOS if t == "fatorial"]
    axi = [(c, f) for c, f, t in CASE_PONTOS if t == "axial"]
    ax.plot([p[0] for p in fat], [p[1] for p in fat], "o", color=PRETO,
            markerfacecolor="white", markersize=4.6, zorder=5, linestyle="",
            label="pontos fatoriais")
    ax.plot([p[0] for p in axi], [p[1] for p in axi], "^", color=PRETO,
            markerfacecolor="white", markersize=4.6, zorder=5, linestyle="",
            label="pontos axiais")
    ax.plot([6.0], [1.0], "o", color=PRETO, markersize=4.6, zorder=6, linestyle="",
            label="ponto central (3 réplicas)")

    co, fo = CASE_OTIMO_NAT
    ax.plot([co], [fo], marker="*", color=AZUL, markersize=13, zorder=8, linestyle="",
            label="ótimo da superfície")
    cm, fm, fckm = CASE_MELHOR_ENSAIO
    ax.plot([cm], [fm], marker="s", color=PRETO, markersize=5.4, zorder=7, linestyle="",
            label="melhor ensaio realizado")
    ax.annotate(
        "",
        xy=(co, fo),
        xytext=(cm, fm),
        arrowprops=dict(arrowstyle="-|>", color=AZUL, lw=1.0,
                        connectionstyle="arc3,rad=0.28"),
        zorder=7,
    )
    ax.text(
        co - 0.12,
        fo + 0.10,
        f"ótimo: {virgula(7.60)} % de cimento,\n{virgula(1.06)} % de fibra"
        f"   ({virgula(round(CASE_OTIMO_FCK, 2))} MPa)",
        fontsize=7.5,
        color=AZUL,
        ha="right",
        va="bottom",
    )
    ax.text(
        cm - 0.08,
        fm - 0.12,
        f"melhor ensaio: {virgula(round(fckm, 2))} MPa",
        fontsize=7.5,
        ha="right",
        va="top",
    )
    ax.set_xlabel("teor de cimento (% em massa)")
    ax.set_ylabel("teor de fibra (% em massa)")
    ax.set_xlim(3.0, 9.0)
    ax.set_ylim(0.25, 1.75)
    ax.legend(loc="lower left", fontsize=7, handletextpad=0.4, borderpad=0.4,
              labelspacing=0.28, frameon=True, facecolor="white",
              edgecolor=CINZA_CLARO, framealpha=1.0)
    fmt_ptbr(ax)
    salvar(fig, "c4-contorno-otimo")


# --------------------------------------------------------------------------
# 7. Caderno 5 — Economia de ensaios
# --------------------------------------------------------------------------


def _saturado_iii(k: int) -> int:
    """Menor plano regular de dois níveis capaz de acomodar k fatores."""
    n = 4
    while n - 1 < k:
        n *= 2
    return n


def fig_ensaios_por_arranjo() -> None:
    """Número de ensaios por arranjo, em escala logarítmica."""
    ks = np.arange(2, 9)
    completo = 2.0**ks
    meia = 2.0 ** (ks - 1)
    saturado = np.array([_saturado_iii(int(k)) for k in ks], dtype=float)

    fig = nova(L_MEDIA, 0.82 * L_MEDIA)
    ax = fig.add_subplot(111)
    grade(ax)
    ax.set_yscale("log", base=2)
    ax.plot(ks, completo, "-o", color=PRETO, markersize=4.0, label=r"fatorial completo $2^{k}$")
    ax.plot(ks, meia, "--s", color=PRETO, markerfacecolor="white", markersize=4.0,
            label=r"meia fração $2^{k-1}$")
    ax.plot(ks, saturado, "-^", color=AZUL, markersize=4.6,
            label="saturado, resolução III")

    ax.axhline(16, color=CINZA, linestyle=":", linewidth=0.9, zorder=2)
    ax.text(2.05, 17.4, "orçamento de 16 corpos de prova", fontsize=7, color=CINZA)

    ax.annotate(
        "7 fatores: 128 ensaios\ncontra 8",
        xy=(7, 128),
        xytext=(4.15, 150),
        fontsize=7.5,
        arrowprops=dict(arrowstyle="-|>", color=PRETO, lw=0.7),
    )
    ax.annotate("", xy=(7, 8), xytext=(4.6, 138),
                arrowprops=dict(arrowstyle="-|>", color=AZUL, lw=0.7,
                                connectionstyle="arc3,rad=-0.25"))

    ax.set_xlabel("k, número de fatores")
    ax.set_ylabel("número de ensaios")
    ax.set_xticks(ks)
    ax.set_yticks([2, 4, 8, 16, 32, 64, 128, 256])
    ax.set_yticklabels(["2", "4", "8", "16", "32", "64", "128", "256"])
    ax.set_ylim(1.6, 420)
    ax.legend(loc="upper left", handletextpad=0.5)
    salvar(fig, "c5-ensaios-por-arranjo")


def fig_corpos_de_prova() -> None:
    """Corpos de prova disponíveis contra informação extraida."""
    orc = np.array([4, 8, 16, 32], dtype=float)
    completo = np.array([int(math.log2(n)) for n in orc], dtype=float)
    replicado = np.array([int(math.log2(n / 2)) for n in orc], dtype=float)
    fracionado = orc - 1

    fig = nova(L_INTEIRA, 0.42 * L_INTEIRA)
    eixos = fig.subplots(1, 2)

    ax = eixos[0]
    grade(ax)
    ax.set_xscale("log", base=2)
    ax.step(orc, fracionado, where="post", color=AZUL, linewidth=1.3,
            label="fracionado saturado")
    ax.plot(orc, fracionado, "^", color=AZUL, markersize=4.6, zorder=4)
    ax.step(orc, completo, where="post", color=PRETO, linewidth=1.1,
            label="fatorial completo")
    ax.plot(orc, completo, "o", color=PRETO, markersize=4.0, zorder=4)
    ax.step(orc, replicado, where="post", color=PRETO, linestyle="--", linewidth=1.1,
            label="fatorial completo, 2 réplicas")
    ax.plot(orc, replicado, "s", color=PRETO, markerfacecolor="white", markersize=4.0,
            zorder=4)
    for xo, yv in zip(orc, fracionado):
        ax.text(xo, yv + 1.2, f"{int(yv)}", fontsize=7, ha="center", color=AZUL)
    ax.set_xticks(orc)
    ax.set_xticklabels([f"{int(v)}" for v in orc])
    ax.set_xlabel("corpos de prova disponíveis")
    ax.set_ylabel("fatores investigáveis")
    ax.set_ylim(0, 36)
    ax.set_title("(a) quantos fatores cabem no orçamento", fontsize=8.5)
    ax.legend(loc="upper left", handletextpad=0.5)

    ax2 = eixos[1]
    grade(ax2)
    kk = np.arange(1, 16)
    gl = 16 - 1 - kk
    ax2.plot(kk, gl, "-", color=PRETO, linewidth=1.1, zorder=3)
    ax2.plot(kk, gl, "o", color=PRETO, markerfacecolor="white", markersize=3.4, zorder=4)
    marcas = ((4, "fatorial\ncompleto", "center"), (7, "meia\nfração", "center"),
              (15, "saturado", "right"))
    for k_mark, rot, alinha in marcas:
        ax2.plot(k_mark, 16 - 1 - k_mark, "^", color=AZUL, markersize=6, zorder=5)
        ax2.annotate(
            rot,
            xy=(k_mark, 16 - 1 - k_mark),
            xytext=(-4 if alinha == "right" else 0, 9),
            textcoords="offset points",
            fontsize=7,
            color=AZUL,
            ha=alinha,
        )
    ax2.axhline(0, color=CINZA, linewidth=0.8, zorder=2)
    ax2.set_xlabel("fatores estudados nos mesmos 16 ensaios")
    ax2.set_ylabel("GL restantes para estimar o erro")
    ax2.set_xticks([1, 4, 7, 10, 15])
    ax2.set_yticks([0, 2, 4, 6, 8, 10, 12, 14])
    ax2.set_ylim(-1.5, 17)
    fmt_ptbr(ax2)
    ax2.set_title("(b) o preço de espremer mais fatores", fontsize=8.5)
    salvar(fig, "c5-corpos-de-prova-vs-informacao")


# --------------------------------------------------------------------------
# 8. Execução
# --------------------------------------------------------------------------

FIGURAS = [
    ("Caderno 1", fig_um_fator_por_vez),
    ("Caderno 1", fig_dispersao_20_medidas),
    ("Caderno 1", fig_blocagem_intervalo),
    ("Caderno 1", fig_variancia_da_media),
    ("Caderno 2", fig_interacao),
    ("Caderno 2", fig_pareto_efeitos),
    ("Caderno 2", fig_normal_efeitos),
    ("Caderno 3", fig_nuvem_reta_residuos),
    ("Caderno 3", fig_decomposicao_sq),
    ("Caderno 3", fig_diagnosticos_residuo),
    ("Caderno 4", fig_linear_vs_quadratico),
    ("Caderno 4", fig_superficie_plana_vs_curva),
    ("Caderno 4", fig_contorno_otimo),
    ("Caderno 5", fig_ensaios_por_arranjo),
    ("Caderno 5", fig_corpos_de_prova),
]


def main() -> None:
    print(f"Largura útil da página: {LINEWIDTH_CM:.2f} cm = {LINEWIDTH_POL:.4f} pol\n")
    atual = None
    for caderno, funcao in FIGURAS:
        if caderno != atual:
            print(f"\n{caderno}")
            atual = caderno
        funcao()
    print(f"\n{len(_REGISTRO)} figuras de matplotlib geradas em {OUT}")
    print("As 5 figuras TikZ são compiladas por `compilar_tikz.ps1`.")


if __name__ == "__main__":
    main()

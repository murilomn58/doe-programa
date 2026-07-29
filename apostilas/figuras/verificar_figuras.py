# -*- coding: utf-8 -*-
"""
Verificação das figuras geradas em `out/`.

Faz três coisas, e falha com código de saída 1 se qualquer uma delas reprovar:

1. Extrai o texto de cada PDF com PyMuPDF e confere que as palavras acentuadas
   saíram com o acento correto. A checagem é dupla: procura grafias sem acento
   que não podem existir no material ("residuo", "variancia", "otimo") e
   confirma que os caracteres acentuados aparecem como o codepoint certo,
   e não como caixa vazia ou substituição.
2. Confere que nenhuma cor fora da paleta (preto, cinza, azul `#1B4E79`)
   aparece no conteúdo do PDF.
3. Renderiza cada figura em PNG dentro de `out/png/`, na resolução em que ela
   será impressa, para inspeção visual.

Uso:
    C:\\Users\\Narcisius\\AppData\\Local\\Programs\\Python\\Python311\\python.exe verificar_figuras.py
"""

from __future__ import annotations

import re
import sys
import unicodedata
from pathlib import Path

import fitz  # PyMuPDF

RAIZ = Path(__file__).resolve().parent
OUT = RAIZ / "out"
PNG = OUT / "png"
PNG.mkdir(parents=True, exist_ok=True)

# Formas corretas das palavras acentuadas que podem aparecer numa figura
# destas apostilas. A grafia errada é derivada em tempo de execução por
# `sem_acento`, para que nenhuma palavra desacentuada precise ser escrita
# aqui dentro. Quem tem espaço no fim só é acusado quando é palavra inteira.
CORRETAS = [
    "resíduo", "resíduos", "variância", "ótimo", "média ", "médio",
    "réplica", "réplicas", "interação", "concentração", "especificação",
    "fração", "resolução", "orçamento", "número", "padrão", "ruído",
    "crítico", "quadrático", "quadráticos", "máximo", "mínimo",
    "superfície", "disponíveis", "investigáveis", "frequência",
    "observações", "decomposição", "proporção", "diferença", "munição",
    "variação", "única", "arbitrárias", "início", "após ", "preço",
    "composição", "nível", "níveis", "análise", "razão", "codificação",
    "projeção", "região", "confiança", "ensaios são", "não ", "são ",
]

# Palavras acentuadas que devem aparecer em pelo menos uma figura: garante que
# a checagem acima não passa apenas porque o texto sumiu.
SENTINELAS = [
    "ótimo", "resíduo", "réplicas", "interação", "número", "variância",
    "fração", "concentração", "padrão", "níveis", "munição", "ruído",
    "projeção", "codificação", "confiança", "vértice",
]

# Paleta permitida: preto puro, cinzas e o azul de apoio.
AZUL_RGB = (0x1B / 255.0, 0x4E / 255.0, 0x79 / 255.0)


def sem_acento(s: str) -> str:
    nfkd = unicodedata.normalize("NFKD", s)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


# Grafia errada -> grafia correta, derivada sem escrever nenhuma palavra
# desacentuada no fonte deste arquivo.
PROIBIDAS = {sem_acento(p): p for p in CORRETAS}


def texto_do_pdf(caminho: Path) -> str:
    doc = fitz.open(caminho)
    partes = [pagina.get_text() for pagina in doc]
    doc.close()
    return "\n".join(partes)


def checar_glifos(txt: str) -> list[str]:
    """Caixa vazia, tofu ou caractere de substituição indicam glifo ausente."""
    ruins = []
    for ch in ("\ufffd", "\u25a1", "\u25a0", "\u0000"):
        if ch in txt:
            ruins.append(f"caractere de glifo ausente U+{ord(ch):04X}")
    return ruins


def main() -> int:
    pdfs = sorted(OUT.glob("*.pdf"))
    if not pdfs:
        print("Nenhum PDF em out/. Rode gerar_figuras.py e compilar_tikz.ps1 antes.")
        return 1

    falhas: list[str] = []
    encontradas: set[str] = set()
    total_texto = 0

    print(f"Verificando {len(pdfs)} figuras em {OUT}\n")
    for pdf in pdfs:
        txt = texto_do_pdf(pdf)
        total_texto += len(txt)
        problemas: list[str] = []

        problemas += checar_glifos(txt)

        baixo = txt.lower()
        for errada, certa in PROIBIDAS.items():
            # Só acusa se a forma sem acento aparecer E a forma certa não for
            # apenas um trecho maior que a contenha (ex.: "media" em "imediato").
            for achado in re.finditer(re.escape(errada), baixo):
                antes = baixo[max(0, achado.start() - 1): achado.start()]
                depois = baixo[achado.end(): achado.end() + 1]
                if antes.isalpha() or (depois.isalpha() and not errada.endswith(" ")):
                    continue
                problemas.append(f"sem acento: '{errada.strip()}' deveria ser '{certa.strip()}'")
                break

        for palavra in SENTINELAS:
            if palavra in baixo:
                encontradas.add(palavra)

        cores = cores_do_pdf(pdf)
        fora = [c for c in cores if not cor_permitida(c)]
        if fora:
            problemas.append(
                "cor fora da paleta: "
                + ", ".join(f"({r:.3f},{g:.3f},{b:.3f})" for r, g, b in fora[:4])
            )

        doc = fitz.open(pdf)
        doc[0].get_pixmap(dpi=200).save(PNG / f"{pdf.stem}.png")
        doc.close()

        if problemas:
            falhas.append(pdf.name)
            print(f"  [FALHA] {pdf.name}")
            for p in problemas:
                print(f"          {p}")
        else:
            n_palavras = len([w for w in re.findall(r"\w+", txt) if len(w) > 1])
            acentos = sum(1 for c in txt if sem_acento(c) != c)
            print(
                f"  [ok] {pdf.name:42s} {n_palavras:4d} palavras, "
                f"{acentos:3d} caracteres acentuados"
            )

    print()
    faltando = [p for p in SENTINELAS if p not in encontradas]
    if faltando:
        print("AVISO: sentinelas não encontradas em nenhuma figura: " + ", ".join(faltando))

    if falhas:
        print(f"\n{len(falhas)} figura(s) reprovada(s): {', '.join(falhas)}")
        return 1
    print(f"Todas as {len(pdfs)} figuras aprovadas. "
          f"{total_texto} caracteres de texto extraidos. PNGs em {PNG}")
    return 0


def cor_permitida(rgb: tuple[float, float, float]) -> bool:
    """Preto, qualquer cinza, o azul de apoio ou um tom dele sobre branco."""
    r, g, b = rgb
    if max(abs(r - g), abs(g - b), abs(r - b)) < 0.02:  # cinza ou preto/branco
        return True
    if all(abs(c - a) < 0.02 for c, a in zip(rgb, AZUL_RGB)):
        return True
    # Tons de `azulDoE!N` usados pelo TikZ: mistura de branco com o azul.
    # Em cada canal, c = 1 - t*(1 - azul). Os três `t` precisam concordar.
    ts = [(1.0 - c) / (1.0 - a) for c, a in zip(rgb, AZUL_RGB)]
    return max(ts) - min(ts) < 0.02 and 0.0 <= min(ts) <= 1.0


def cores_do_pdf(caminho: Path) -> list[tuple[float, float, float]]:
    """Lê os operadores de cor RGB do fluxo de conteúdo do PDF."""
    doc = fitz.open(caminho)
    achadas: set[tuple[float, float, float]] = set()
    padrao = re.compile(
        rb"([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+(rg|RG)\b"
    )
    for pagina in doc:
        fluxo = pagina.read_contents()
        for m in padrao.finditer(fluxo):
            try:
                rgb = tuple(round(float(m.group(i)), 4) for i in (1, 2, 3))
            except ValueError:
                continue
            achadas.add(rgb)  # type: ignore[arg-type]
    doc.close()
    return sorted(achadas)


if __name__ == "__main__":
    sys.exit(main())

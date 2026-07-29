"""Confere se os links `#page=N` da interface caem na página certa do caderno.

A orientação de blocagem, no card do fator qualitativo, manda o aluno para uma
seção específica de uma apostila por meio de `.../por-que-planejar.pdf#page=10`.
Isso é um número de página cru: basta alguém acrescentar um parágrafo antes da
seção para o link passar a apontar para outro assunto, sem erro de compilação,
sem teste vermelho e sem ninguém perceber. Só o aluno perceberia, na aula.

Este verificador extrai os links do código-fonte da interface, abre o PDF
publicado e confirma que a página apontada contém o texto esperado.

Uso:
    python scripts/verificar_links_pdf.py

Sai com código 1 se algum link apontar para a página errada, se o PDF não
existir, ou se um link novo aparecer sem expectativa registrada aqui.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
FONTES = RAIZ / "frontend" / "src"
PDFS = RAIZ / "frontend" / "public" / "conteudo" / "pdf"

# Link -> trecho que a página apontada tem de conter. A chave é o caminho como
# aparece no código; o valor é uma frase curta e estável da seção de destino.
#
# Ao acrescentar um link `#page=N` na interface, registre-o aqui. Um link sem
# expectativa é tratado como falha, de propósito: é o que impede que o portão
# vire decoração.
ESPERADO: dict[str, str] = {
    "/conteudo/pdf/por-que-planejar.pdf#page=10": "Blocagem",
}

PADRAO_LINK = re.compile(r"/conteudo/pdf/[a-z0-9-]+\.pdf#page=\d+")


def links_na_interface() -> dict[str, list[str]]:
    """Todos os links `#page=N` do código da interface, e onde aparecem."""
    achados: dict[str, list[str]] = {}
    for arquivo in FONTES.rglob("*.ts*"):
        try:
            texto = arquivo.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        for link in PADRAO_LINK.findall(texto):
            achados.setdefault(link, []).append(
                str(arquivo.relative_to(RAIZ)).replace("\\", "/")
            )
    return achados


def texto_da_pagina(pdf: Path, pagina_1based: int) -> str:
    import fitz  # PyMuPDF

    with fitz.open(pdf) as doc:
        if not 1 <= pagina_1based <= doc.page_count:
            raise IndexError(
                f"{pdf.name} tem {doc.page_count} páginas; o link pede a {pagina_1based}."
            )
        return doc[pagina_1based - 1].get_text()


def main() -> int:
    achados = links_na_interface()
    if not achados:
        print("Nenhum link `#page=N` encontrado na interface.")
        return 0

    problemas: list[str] = []
    for link, onde in sorted(achados.items()):
        origem = ", ".join(sorted(set(onde)))
        if link not in ESPERADO:
            problemas.append(
                f"{link}\n  usado em {origem}\n"
                f"  sem expectativa registrada em scripts/verificar_links_pdf.py"
            )
            continue

        arquivo, _, fragmento = link.partition("#")
        pdf = PDFS / Path(arquivo).name
        pagina = int(fragmento.removeprefix("page="))
        if not pdf.exists():
            problemas.append(f"{link}\n  usado em {origem}\n  PDF não existe: {pdf}")
            continue

        try:
            texto = texto_da_pagina(pdf, pagina)
        except IndexError as exc:
            problemas.append(f"{link}\n  usado em {origem}\n  {exc}")
            continue

        trecho = ESPERADO[link]
        if trecho.lower() in texto.lower():
            print(f"ok  {link}  (página {pagina} contém {trecho!r})")
        else:
            problemas.append(
                f"{link}\n  usado em {origem}\n"
                f"  a página {pagina} de {pdf.name} não contém {trecho!r}.\n"
                f"  O caderno provavelmente foi repaginado: confira onde a seção "
                f"está agora e atualize o link e a expectativa."
            )

    print(f"\nLinks verificados: {len(achados)}")
    if problemas:
        print(f"Problemas encontrados: {len(problemas)}\n")
        for p in problemas:
            print(p)
        return 1
    print("Todos os links apontam para a página certa.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Verificador de acentuação portuguesa nos materiais do projeto.

Todo conteúdo publicado (apostilas, texto de interface, rótulos de figura,
roteiro de aula, documentação) precisa sair com acentuação plena. Este script
faz três verificações independentes:

1. Codificação: o arquivo é UTF-8 válido?
2. Mojibake: aparecem sequências como "Ã§" ou "Ã£", sinal de arquivo lido em
   Latin-1 e gravado como UTF-8?
3. Acento faltando: alguma palavra do dicionário abaixo aparece na forma sem
   acento, num contexto em que ela é texto e não identificador de código?

Em arquivos de código (.ts, .tsx, .py, .mjs) a busca se restringe a strings e
comentários, porque identificador sem acento é legítimo e às vezes obrigatório.
Em .md, .tex e .txt o arquivo inteiro é conteúdo.

Uso:
    python scripts/verificar_acentuacao.py [caminho ...]

Sem argumento, varre os diretórios de conteúdo do projeto. Sai com código 1 se
encontrar qualquer problema, para poder entrar num portão de qualidade.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

# Diretórios varridos quando nenhum caminho é passado.
ALVOS_PADRAO = [
    "apostilas",
    "aula-ime",
    "docs/adp",
    "frontend/src",
    "frontend/tests",
]

EXTENSOES_CONTEUDO = {".md", ".tex", ".cls", ".txt", ".bib"}
EXTENSOES_CODIGO = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".py", ".css"}

IGNORAR_DIRETORIOS = {
    "node_modules", ".git", ".next", "__pycache__", ".venv", "out",
    "dist", "build", ".vercel", "figuras/out",
}

# Palavra sem acento -> forma correta. Restrito a casos em que a forma sem
# acento não é uma palavra portuguesa válida por si só, para não gerar ruído.
# Deixadas de fora de propósito: "e/é", "a/à", "esta/está", "cara/cará",
# "secretaria/secretária" e afins, cuja forma sem acento é legítima e exige
# julgamento de contexto que um regex não faz.
DICIONARIO: dict[str, str] = {
    # estatística e planejamento de experimentos
    "variancia": "variância",
    "variancias": "variâncias",
    "covariancia": "covariância",
    "residuo": "resíduo",
    "residuos": "resíduos",
    # "replica" fica de fora: é também o verbo replicar na 3ª pessoa
    # ("quem não replica não estima o erro"), legítimo sem acento.
    "replicas": "réplicas",
    "analise": "análise",
    "analises": "análises",
    "estatistica": "estatística",
    "estatisticas": "estatísticas",
    "estatistico": "estatístico",
    "estatisticos": "estatísticos",
    "hipotese": "hipótese",
    "hipoteses": "hipóteses",
    "quadratico": "quadrático",
    "quadraticos": "quadráticos",
    "quadratica": "quadrática",
    "quadraticas": "quadráticas",
    "minimos": "mínimos",
    "maximo": "máximo",
    "maximos": "máximos",
    "maxima": "máxima",
    "minimo": "mínimo",
    "minima": "mínima",
    "otimo": "ótimo",
    "otima": "ótima",
    "otimizacao": "otimização",
    "significancia": "significância",
    "confianca": "confiança",
    "aleatorio": "aleatório",
    "aleatoria": "aleatória",
    "aleatorizacao": "aleatorização",
    "sistematico": "sistemático",
    "sistematica": "sistemática",
    "grafico": "gráfico",
    "graficos": "gráficos",
    "parametro": "parâmetro",
    "parametros": "parâmetros",
    "numerico": "numérico",
    "numerica": "numérica",
    "numericos": "numéricos",
    "polinomio": "polinômio",
    "criterio": "critério",
    "criterios": "critérios",
    "medias": "médias",
    "curvatura_": "curvatura",  # sentinela inofensiva, mantém o dicionário par
    # engenharia e laboratório
    "cientifico": "científico",
    "cientifica": "científica",
    "laboratorio": "laboratório",
    "material_": "material",
    "resistencia": "resistência",
    "compressao": "compressão",
    "tracao": "tração",
    "tensao": "tensão",
    "tensoes": "tensões",
    "deformacao": "deformação",
    "granulometria_": "granulometria",
    "umidade_": "umidade",
    "cimento_": "cimento",
    "modulo": "módulo",
    "densidade_": "densidade",
    "especifico": "específico",
    "especifica": "específica",
    "fisico": "físico",
    "fisica": "física",
    "quimico": "químico",
    "quimica": "química",
    "mecanico": "mecânico",
    "mecanica": "mecânica",
    # vocabulário geral que aparece em interface e texto corrido
    "nao": "não",
    "sao": "são",
    "voce": "você",
    "esta_": "está",
    "tambem": "também",
    "apos": "após",
    "atraves": "através",
    "ate_": "até",
    "porem": "porém",
    "alem": "além",
    "ja_": "já",
    "so_": "só",
    "tres": "três",
    "possivel": "possível",
    "possiveis": "possíveis",
    "impossivel": "impossível",
    "necessario": "necessário",
    "necessaria": "necessária",
    "obrigatorio": "obrigatório",
    "obrigatoria": "obrigatória",
    "usuario": "usuário",
    "usuarios": "usuários",
    "relatorio": "relatório",
    "relatorios": "relatórios",
    "didatico": "didático",
    "didatica": "didática",
    "conteudo": "conteúdo",
    "conteudos": "conteúdos",
    "pagina": "página",
    "paginas": "páginas",
    "codigo": "código",
    "codigos": "códigos",
    "referencia": "referência",
    "referencias": "referências",
    "sequencia": "sequência",
    "consequencia": "consequência",
    "frequencia": "frequência",
    "experiencia": "experiência",
    "diferenca": "diferença",
    "diferencas": "diferenças",
    "presenca": "presença",
    "ausencia": "ausência",
    "existencia": "existência",
    "influencia": "influência",
    "ciencia": "ciência",
    "ciencias": "ciências",
    "importancia": "importância",
    "distancia": "distância",
    "tolerancia": "tolerância",
    "instancia": "instância",
    "constancia": "constância",
    "informacao": "informação",
    "informacoes": "informações",
    "aplicacao": "aplicação",
    "aplicacoes": "aplicações",
    "execucao": "execução",
    "definicao": "definição",
    "definicoes": "definições",
    "condicao": "condição",
    "condicoes": "condições",
    "funcao": "função",
    "funcoes": "funções",
    "opcao": "opção",
    "opcoes": "opções",
    "acao": "ação",
    "acoes": "ações",
    "secao": "seção",
    "secoes": "seções",
    "versao": "versão",
    "versoes": "versões",
    "razao": "razão",
    "razoes": "razões",
    "fracao": "fração",
    "fracoes": "frações",
    "solucao": "solução",
    "solucoes": "soluções",
    "questao": "questão",
    "questoes": "questões",
    "padrao": "padrão",
    "padroes": "padrões",
    "nivel": "nível",
    "niveis": "níveis",
    "numero": "número",
    "numeros": "números",
    "titulo": "título",
    "titulos": "títulos",
    "ultimo": "último",
    "ultima": "última",
    "proximo": "próximo",
    "proxima": "próxima",
    "unico": "único",
    "unica": "única",
    "multiplo": "múltiplo",
    "multipla": "múltipla",
    "automatico": "automático",
    "automatica": "automática",
    "basico": "básico",
    "basica": "básica",
    "pratico": "prático",
    "pratica_": "prática",
    "teorico": "teórico",
    "teorica": "teórica",
    "historico": "histórico",
    "dinamico": "dinâmico",
    "dinamica": "dinâmica",
    "estatico": "estático",
    "publico": "público",
    "publica": "pública",
    "especifico_": "específico",
    "grafica": "gráfica",
    "logica": "lógica",
    "logico": "lógico",
    "tecnico": "técnico",
    "tecnica": "técnica",
    "tecnicas": "técnicas",
    "metodo": "método",
    "metodos": "métodos",
    "modelo_": "modelo",
    "algebrico": "algébrico",
    "algebrica": "algébrica",
    "superficie": "superfície",
    "superficies": "superfícies",
    "area_": "área",
    "areas_": "áreas",
    "serie_": "série",
    "series_": "séries",
    "orgao": "órgão",
    "duvida": "dúvida",
    "duvidas": "dúvidas",
    "saida": "saída",
    "saidas": "saídas",
    "entrada_": "entrada",
    "inicio": "início",
    "memoria": "memória",
    "categoria_": "categoria",
    "obvio": "óbvio",
    "obvia": "óbvia",
    "previo": "prévio",
    # "previa" fica de fora: é também o verbo prever no imperfeito
    # ("o planejamento previa réplicas").
    "media_": "média",
    "proprio": "próprio",
    "propria": "própria",
    "proprios": "próprios",
    "proprias": "próprias",
    "orientacao": "orientação",
    "verificacao": "verificação",
    "validacao": "validação",
    "configuracao": "configuração",
    "instalacao": "instalação",
    "publicacao": "publicação",
    "identificacao": "identificação",
    "classificacao": "classificação",
    "interpretacao": "interpretação",
    "apresentacao": "apresentação",
    "recomendacao": "recomendação",
    "explicacao": "explicação",
    "observacao": "observação",
    "comparacao": "comparação",
    "combinacao": "combinação",
    "variacao": "variação",
    "correlacao": "correlação",
    "estimacao": "estimação",
    "distribuicao": "distribuição",
    "contribuicao": "contribuição",
    "substituicao": "substituição",
    "construcao": "construção",
    "producao": "produção",
    "reducao": "redução",
    "medicao": "medição",
    "moldagem_": "moldagem",
    "separacao": "separação",
    "preparacao": "preparação",
    "conservacao": "conservação",
    "armazenagem_": "armazenagem",
    "codificacao": "codificação",
    "normalizacao": "normalização",
    "interacao": "interação",
    "interacoes": "interações",
    "concentracao": "concentração",
    "composicao": "composição",
    "resolucao": "resolução",
    "projecao": "projeção",
    "regressao": "regressão",
    "conclusao": "conclusão",
    "conclusoes": "conclusões",
    "discussao": "discussão",
    "revisao": "revisão",
    "decisao": "decisão",
    "decisoes": "decisões",
    "precisao": "precisão",
    "dimensao": "dimensão",
    "extensao": "extensão",
    # estrutura de documento
    "sumario": "sumário",
    "indice": "índice",
    "apendice": "apêndice",
    "apendices": "apêndices",
    "capitulo": "capítulo",
    "capitulos": "capítulos",
    "formula": "fórmula",
    "formulas": "fórmulas",
    "calculo": "cálculo",
    "calculos": "cálculos",
    "clicavel": "clicável",
    "legivel": "legível",
    "visivel": "visível",
    "invisivel": "invisível",
    "disponivel": "disponível",
    "responsavel": "responsável",
    "variavel": "variável",
    "variaveis": "variáveis",
    "estavel": "estável",
    "aceitavel": "aceitável",
    "confiavel": "confiável",
    "compativel": "compatível",
    "incompativel": "incompatível",
    "utilizavel": "utilizável",
    # "series" fica de fora: é palavra inglesa corrente em código de gráfico
    # ("per series", "series name") e o falso positivo supera o ganho.
    "espaco": "espaço",
    "espacos": "espaços",
    "espacamento": "espaçamento",
    "cabecalho": "cabeçalho",
    "cabecalhos": "cabeçalhos",
    "rodape": "rodapé",
    "traco": "traço",
    "linguagem_": "linguagem",
    "portugues": "português",
    "ingles": "inglês",
    "japones": "japonês",
    "voces": "vocês",
    "ninguem": "ninguém",
    "alguem": "alguém",
    "porcentagem_": "porcentagem",
    "porcento": "por cento",
    "ambito": "âmbito",
    "enfase": "ênfase",
    "sintese": "síntese",
    "analogo": "análogo",
    "analoga": "análoga",
    "identico": "idêntico",
    "identica": "idêntica",
    "generico": "genérico",
    "generica": "genérica",
    "especie": "espécie",
    "criterio_": "critério",
    "dominio": "domínio",
    "cenario": "cenário",
    "cenarios": "cenários",
    "glossario": "glossário",
    "formulario": "formulário",
    "comentario": "comentário",
    "comentarios": "comentários",
    "necessarios": "necessários",
    "necessarias": "necessárias",
    "diario": "diário",
    "anuario_": "anuário",
    "salario_": "salário",
    "obrigatorios": "obrigatórios",
    "obrigatorias": "obrigatórias",
}

# As chaves com sufixo "_" acima existem só para documentar termos vizinhos
# sem criar regra: são removidas aqui.
DICIONARIO = {k: v for k, v in DICIONARIO.items() if not k.endswith("_")}

PADRAO_MOJIBAKE = re.compile(r"Ã[\x80-\xbf]|Â[\x80-\xbf]|â€[\x9c\x9d\x99]|ï»¿")

# Trechos que não são conteúdo em português e geram falso positivo.
LINHA_IGNORADA = re.compile(
    r"^\s*(import|from|export\s+\*|require\()"
    r"|^\s*(https?://|www\.)"
    r"|^\s*[-*]\s*\[.+\]\(.+\)\s*$",
    re.IGNORECASE,
)

# Nome de arquivo, caminho, URL, identificador de código e código inline não
# são texto corrido: um PDF chamado "superficie d resposta.pdf" existe assim no
# disco e renomeá-lo quebraria as referências. Removidos antes da busca.
# Sem re.IGNORECASE: a flag global transformaria o padrão de camelCase em \w+
# e apagaria o texto inteiro, escondendo todos os problemas reais.
RUIDO = re.compile(
    r"`[^`]*`"                                   # código inline em markdown
    r"|\$[^$]*\$"                                # matemática inline em LaTeX
    # Nome de ambiente e de comando LaTeX é identificador e vem SEM acento.
    # Precisa vir antes do padrão genérico de comando: a alternância do regex
    # é first-match-wins, e "\\[A-Za-z@]+" consumiria só a barra invertida,
    # deixando "{aplicacao}" exposto.
    r"|\\(?:begin|end|newenvironment|renewenvironment|newcommand|renewcommand|input|usepackage|label|ref|cite)\s*\{[^}]*\}"
    r"|\\[A-Za-z@]+"                             # demais comandos LaTeX
    r"|https?://\S+"                             # URL
    r"|[^\s\"'`]*[/\\][^\s\"'`]*"                # qualquer token com barra
    # Nome de arquivo, inclusive os que têm espaço e vêm entre aspas: eles
    # existem assim no disco e renomeá-los quebraria as referências.
    r"|\"[^\"\n]*\.(?i:md|tex|cls|bib|pdf|py|ts|tsx|js|mjs|json|csv|xlsx|png|svg|ps1|txt|yml|yaml)\""
    r"|[\w.\-]+\.(?i:md|tex|cls|bib|pdf|py|ts|tsx|js|mjs|json|csv|xlsx|png|svg|ps1|txt|yml|yaml)\b"
    r"|\b[A-Za-z0-9]+(?:[_-][A-Za-z0-9]+)+\b"    # snake_case e kebab-case
    r"|\b[a-z]+[A-Z][A-Za-z0-9]*\b"              # camelCase
    r"|\b[\w.+-]+@[\w.-]+\b"                     # email de exemplo
)

# Em código, uma string de palavra única sem espaço quase sempre é chave,
# slug ou nome de arquivo de download, não texto para o usuário ler.
STRING_IDENTIFICADORA = re.compile(r"^[\"'`][A-Za-z0-9]+[\"'`]$")

# Escotilha de saída: a linha com este marcador é pulada. Para transcrição
# literal de saída de software, nome próprio ou termo estrangeiro.
MARCADOR_EXCECAO = "acentuacao-ok"

# Em código, só interessa o que está dentro de string ou comentário.
TRECHO_TEXTUAL = re.compile(
    r'"(?:[^"\\]|\\.)*"'
    r"|'(?:[^'\\]|\\.)*'"
    r"|`(?:[^`\\]|\\.)*`"
    r"|//[^\n]*"
    r"|#[^\n]*"
    r"|/\*.*?\*/",
    re.DOTALL,
)


def trechos_a_verificar(linha: str, e_codigo: bool) -> list[str]:
    if not e_codigo:
        return [RUIDO.sub(" ", linha)]
    brutos = [t for t in TRECHO_TEXTUAL.findall(linha)
              if not STRING_IDENTIFICADORA.match(t.strip())]
    return [RUIDO.sub(" ", trecho) for trecho in brutos]


def arquivos_alvo(caminhos: list[Path]) -> list[Path]:
    encontrados: list[Path] = []
    for caminho in caminhos:
        if caminho.is_file():
            encontrados.append(caminho)
            continue
        for item in caminho.rglob("*"):
            if not item.is_file():
                continue
            if any(parte in IGNORAR_DIRETORIOS for parte in item.parts):
                continue
            if item.suffix.lower() in EXTENSOES_CONTEUDO | EXTENSOES_CODIGO:
                encontrados.append(item)
    return sorted(set(encontrados))


def verificar(arquivo: Path) -> list[str]:
    problemas: list[str] = []
    bruto = arquivo.read_bytes()

    try:
        texto = bruto.decode("utf-8")
    except UnicodeDecodeError as erro:
        return [f"{arquivo}: não é UTF-8 válido ({erro})"]

    if PADRAO_MOJIBAKE.search(texto):
        for numero, linha in enumerate(texto.splitlines(), start=1):
            if PADRAO_MOJIBAKE.search(linha):
                problemas.append(
                    f"{arquivo}:{numero}: codificação corrompida (mojibake) -> {linha.strip()[:90]}"
                )

    e_codigo = arquivo.suffix.lower() in EXTENSOES_CODIGO
    for numero, linha in enumerate(texto.splitlines(), start=1):
        if MARCADOR_EXCECAO in linha or LINHA_IGNORADA.search(linha):
            continue
        for trecho in trechos_a_verificar(linha, e_codigo):
            for palavra in re.findall(r"[A-Za-zÀ-ÿ]+", trecho):
                correta = DICIONARIO.get(palavra.lower())
                if correta:
                    problemas.append(
                        f"{arquivo}:{numero}: '{palavra}' deveria ser '{correta}'"
                    )
    return problemas


def main() -> int:
    argumentos = sys.argv[1:]
    if argumentos:
        caminhos = [Path(a).resolve() for a in argumentos]
    else:
        caminhos = [RAIZ / alvo for alvo in ALVOS_PADRAO]
        caminhos = [c for c in caminhos if c.exists()]

    todos = arquivos_alvo(caminhos)
    problemas: list[str] = []
    for arquivo in todos:
        problemas.extend(verificar(arquivo))

    print(f"Arquivos verificados: {len(todos)}")
    if not problemas:
        print("Nenhum problema de acentuação encontrado.")
        return 0

    print(f"Problemas encontrados: {len(problemas)}\n")
    for problema in problemas:
        try:
            print(problema)
        except UnicodeEncodeError:
            print(problema.encode("ascii", "replace").decode("ascii"))
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

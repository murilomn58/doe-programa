"""Toda família de arranjo precisa honrar o número de réplicas.

Antes desta blindagem, só o fatorial 2^k e o fracionado expandiam réplicas: os
demais construtores devolviam um bloco único com ``replicate=1``. A interface
sempre anunciou ``ensaios de um bloco x réplicas``, de modo que o usuário pedia
32 ensaios, via 32 na tela e recebia uma matriz de 16, sem aviso nenhum. É falha
de integridade, não de apresentação: o pesquisador moldaria metade dos corpos de
prova imaginando ter o erro puro que as réplicas dariam.

Este arquivo existe para que uma família nova não volte a esquecer.
"""

import pytest
from pydantic import ValidationError

from domain.schemas import DesignGenerateRequest
from domain.types import DesignType
from services import design_service


def _quantitativo(nome: str, baixo: float, alto: float, centro: float) -> dict:
    """Fator quantitativo de três níveis, aceito por todas as famílias de RSM."""
    return {
        "name": nome,
        "factor_type": "quantitative",
        "unit": "%",
        "low": baixo,
        "high": alto,
        "levels": [baixo, centro, alto],
    }


def _dois_niveis(nome: str, baixo: float, alto: float) -> dict:
    """Fator de dois níveis, para as famílias de triagem."""
    return {
        "name": nome,
        "factor_type": "quantitative",
        "unit": "%",
        "low": baixo,
        "high": alto,
    }


DOIS_FATORES = [
    _quantitativo("Cimento", 3.0, 9.0, 6.0),
    _quantitativo("Fibra", 1.0, 5.0, 3.0),
]
TRES_FATORES = DOIS_FATORES + [_quantitativo("Umidade", 8.0, 14.0, 11.0)]
SEIS_DE_DOIS_NIVEIS = [
    _dois_niveis(nome, 1.0, 3.0) for nome in ("A", "B", "C", "D", "E", "F")
]
RESPOSTAS = [{"name": "fck", "unit": "MPa"}]

# (tipo de arranjo, fatores, configuração específica da família)
FAMILIAS = [
    (DesignType.FULL_FACTORIAL_2K, DOIS_FATORES, {}),
    (
        DesignType.FRACTIONAL_FACTORIAL_2KP,
        SEIS_DE_DOIS_NIVEIS,
        {"fractional": {"resolution": 4}},
    ),
    (DesignType.FULL_FACTORIAL_GENERAL, DOIS_FATORES, {}),
    (DesignType.CENTRAL_COMPOSITE, DOIS_FATORES, {"ccd": {"variant": "face_centered"}}),
    (DesignType.BOX_BEHNKEN, TRES_FATORES, {}),
    (DesignType.TAGUCHI, TRES_FATORES, {}),
    (DesignType.PLACKETT_BURMAN, SEIS_DE_DOIS_NIVEIS, {}),
    (DesignType.DSD, SEIS_DE_DOIS_NIVEIS, {}),
    (
        DesignType.OPTIMAL,
        DOIS_FATORES,
        {"optimal": {"criterion": "D", "model": "linear_quadratic", "n_runs": 10}},
    ),
]


def _gerar(tipo: DesignType, fatores: list[dict], extra: dict, replicas: int):
    corpo = {
        "name": "teste de réplicas",
        "design_type": tipo.value,
        "factors": fatores,
        "responses": RESPOSTAS,
        "replicates": replicas,
        "seed": 7,
    }
    corpo.update(extra)
    return design_service._build_design(DesignGenerateRequest.model_validate(corpo))


@pytest.mark.parametrize(
    ("tipo", "fatores", "extra"), FAMILIAS, ids=[f[0].value for f in FAMILIAS]
)
def test_duas_replicas_dobram_os_ensaios(tipo, fatores, extra):
    um = _gerar(tipo, fatores, extra, 1)
    dois = _gerar(tipo, fatores, extra, 2)
    assert len(dois.runs) == 2 * len(um.runs), (
        f"{tipo.value} anunciaria o dobro de ensaios e entregaria "
        f"{len(dois.runs)} contra {len(um.runs)} de um bloco."
    )


@pytest.mark.parametrize(
    ("tipo", "fatores", "extra"), FAMILIAS, ids=[f[0].value for f in FAMILIAS]
)
def test_replicas_sao_numeradas_e_a_ordem_padrao_e_unica(tipo, fatores, extra):
    tres = _gerar(tipo, fatores, extra, 3)

    assert sorted({r.replicate for r in tres.runs}) == [1, 2, 3]

    # Cada réplica repete o bloco inteiro, com o mesmo número de ensaios.
    por_replica = {}
    for run in tres.runs:
        por_replica.setdefault(run.replicate, []).append(run)
    tamanhos = {len(v) for v in por_replica.values()}
    assert len(tamanhos) == 1, f"blocos de tamanhos diferentes: {tamanhos}"

    # Ordem padrão única de 1 a N, e ordem de execução uma permutação de 1 a N.
    n = len(tres.runs)
    assert sorted(r.std_order for r in tres.runs) == list(range(1, n + 1))
    assert sorted(r.run_order for r in tres.runs) == list(range(1, n + 1))


@pytest.mark.parametrize(
    ("tipo", "fatores", "extra"), FAMILIAS, ids=[f[0].value for f in FAMILIAS]
)
def test_uma_replica_nao_altera_o_arranjo(tipo, fatores, extra):
    """Réplica igual a 1 tem de ser exatamente o bloco base, sem reordenar nada."""
    design = _gerar(tipo, fatores, extra, 1)
    assert {r.replicate for r in design.runs} == {1}
    n = len(design.runs)
    assert sorted(r.std_order for r in design.runs) == list(range(1, n + 1))


def test_replicas_ficam_intercaladas_na_ordem_de_execucao():
    """A ordem de execução sorteia sobre o conjunto todo, não bloco a bloco.

    Executar a réplica 1 inteira e só depois a 2 confundiria a repetição com
    qualquer deriva do laboratório ao longo do tempo, que é justamente o que a
    aleatorização existe para evitar.
    """
    design = _gerar(
        DesignType.CENTRAL_COMPOSITE,
        DOIS_FATORES,
        {"ccd": {"variant": "face_centered"}},
        2,
    )
    por_ordem = sorted(design.runs, key=lambda r: r.run_order)
    metade = len(por_ordem) // 2
    primeira_metade = [r.replicate for r in por_ordem[:metade]]
    # Se os blocos saíssem em sequência, a primeira metade seria toda réplica 1.
    assert len(set(primeira_metade)) > 1


def test_zero_replicas_e_recusado():
    with pytest.raises(ValidationError):
        _gerar(
            DesignType.CENTRAL_COMPOSITE,
            DOIS_FATORES,
            {"ccd": {"variant": "face_centered"}},
            0,
        )

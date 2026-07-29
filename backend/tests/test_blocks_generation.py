"""O usuário declara QUANTOS BLOCOS quer no planejamento (Task 1).

Caso motivador: um pesquisador tem 7 tipos de solo. Fator qualitativo só
aceita 2 categorias, então tipo de solo vira BLOCO — cada bloco recebe uma
repetição completa do arranjo, e os fatores são comparados dentro de cada
bloco. Um 3² em 7 blocos são 63 ensaios.

Semântica travada (não é opinião deste arquivo, é contrato do domínio):
- Total de ensaios = base × blocos × réplicas.
- Bloco = repetição completa do arranjo sob uma condição conhecida diferente
  (lote de material, dia de moldagem, tipo de solo): fonte de variação que o
  estudo isola, não investiga.
- Réplica = repetição sob a MESMA condição (o erro puro).
- blocks=7, replicates=1 é o RCBD dos 7 solos: 7 cópias, blocos 1 a 7,
  réplica 1 em cada.
- blocks=1, replicates=2 é o comportamento anterior à Task 1: 2 cópias,
  bloco 1, réplicas 1 e 2.
"""

import numpy as np
import pytest
from pydantic import ValidationError

from domain.schemas import DesignGenerateRequest
from domain.types import DesignType
from services import design_service

# Reaproveita as famílias e os fatores já usados pela blindagem de réplicas,
# para não reinventar 9 corpos de prova diferentes (e para o portão desta
# entrega continuar honrando o mesmo universo de famílias já coberto).
from tests.test_replicates_all_families import (
    DOIS_FATORES,
    FAMILIAS,
    RESPOSTAS,
)


def _quantitativo(nome: str, baixo: float, alto: float, centro: float) -> dict:
    return {
        "name": nome,
        "factor_type": "quantitative",
        "unit": "%",
        "low": baixo,
        "high": alto,
        "levels": [baixo, centro, alto],
    }


TRES_POR_TRES = [
    _quantitativo("Cimento", 3.0, 9.0, 6.0),
    _quantitativo("Fibra", 1.0, 5.0, 3.0),
]


def _gerar(
    tipo: DesignType,
    fatores: list[dict],
    extra: dict,
    blocks: int,
    replicates: int,
    seed: int | None = 7,
):
    corpo = {
        "name": "teste de blocos",
        "design_type": tipo.value,
        "factors": fatores,
        "responses": RESPOSTAS,
        "blocks": blocks,
        "replicates": replicates,
        "seed": seed,
    }
    corpo.update(extra)
    return design_service._build_design(DesignGenerateRequest.model_validate(corpo))


def _tres_ao_quadrado(blocks: int, replicates: int = 1, seed: int | None = 7):
    """3² de dois fatores (Cimento × Fibra), o caso motivador dos 7 solos."""
    return _gerar(
        DesignType.FULL_FACTORIAL_GENERAL,
        TRES_POR_TRES,
        {},
        blocks,
        replicates,
        seed,
    )


def test_sete_blocos_de_um_3x3_da_63_ensaios_numerados_1_a_7():
    design = _tres_ao_quadrado(blocks=7)
    assert len(design.runs) == 63
    assert sorted({r.block for r in design.runs}) == list(range(1, 8))
    # RCBD: uma réplica só, dentro de cada bloco.
    assert {r.replicate for r in design.runs} == {1}


def test_cada_bloco_contem_o_arranjo_completo():
    """As 9 combinações do 3² devem aparecer inteiras em cada um dos 7 blocos."""
    design = _tres_ao_quadrado(blocks=7)
    nomes = [f.name for f in design.factors]

    combinacoes_esperadas = None
    por_bloco: dict[int, list[tuple[float, ...]]] = {}
    for run in design.runs:
        combinacao = tuple(run.cells[nome].coded for nome in nomes)
        por_bloco.setdefault(run.block, []).append(combinacao)

    assert sorted(por_bloco.keys()) == list(range(1, 8))
    for bloco, combinacoes in por_bloco.items():
        assert len(combinacoes) == 9, f"bloco {bloco} com {len(combinacoes)} ensaios"
        if combinacoes_esperadas is None:
            combinacoes_esperadas = sorted(combinacoes)
        assert sorted(combinacoes) == combinacoes_esperadas, (
            f"bloco {bloco} não repete o arranjo completo dos demais blocos"
        )


def test_ortogonalidade_fatores_x_blocos():
    """As colunas dos fatores são ortogonais à codificação de bloco.

    Cada bloco é uma cópia idêntica do arranjo inteiro (mesma distribuição de
    níveis), então a média de qualquer fator é a MESMA dentro de todo bloco —
    exatamente a condição de covariância nula entre a coluna do fator e
    qualquer indicador (dummy) de bloco. Testado por cálculo explícito, não
    suposto pela construção.
    """
    design = _tres_ao_quadrado(blocks=7)
    for factor in design.factors:
        codigos = np.array([r.cells[factor.name].coded for r in design.runs])
        blocos = np.array([r.block for r in design.runs])
        media_geral = codigos.mean()
        for bloco in sorted(set(blocos)):
            media_do_bloco = codigos[blocos == bloco].mean()
            assert media_do_bloco == pytest.approx(media_geral, abs=1e-9), (
                f"fator '{factor.name}' não é ortogonal ao bloco {bloco}"
            )

        # Confirmação direta via correlação com o indicador de cada bloco.
        for bloco in sorted(set(blocos)):
            indicador = (blocos == bloco).astype(float)
            covariancia = np.cov(codigos, indicador, bias=True)[0, 1]
            assert covariancia == pytest.approx(0.0, abs=1e-9), (
                f"fator '{factor.name}' correlacionado ao indicador do bloco {bloco}"
            )


@pytest.mark.parametrize(
    ("tipo", "fatores", "extra"), FAMILIAS, ids=[f[0].value for f in FAMILIAS]
)
def test_blocos_e_replicas_se_multiplicam_em_todas_as_familias(tipo, fatores, extra):
    """blocks=3, replicates=2 dá base × 6, nas nove famílias.

    Cobre a armadilha do 2^k / fracionado: expandem réplicas internamente, e
    a expansão de blocos precisa ser aplicada por fora sem duplicar a
    contagem de réplicas já embutida.
    """
    base = _gerar(tipo, fatores, extra, blocks=1, replicates=1)
    combinado = _gerar(tipo, fatores, extra, blocks=3, replicates=2)
    assert len(combinado.runs) == 6 * len(base.runs), (
        f"{tipo.value}: esperava {6 * len(base.runs)} ensaios "
        f"(base {len(base.runs)} × 3 blocos × 2 réplicas), recebi "
        f"{len(combinado.runs)}."
    )
    assert sorted({r.block for r in combinado.runs}) == [1, 2, 3]
    assert sorted({r.replicate for r in combinado.runs}) == [1, 2]
    # Cada par (bloco, réplica) precisa ter exatamente o tamanho da base.
    por_par: dict[tuple[int, int], int] = {}
    for run in combinado.runs:
        chave = (run.block, run.replicate)
        por_par[chave] = por_par.get(chave, 0) + 1
    assert set(por_par.values()) == {len(base.runs)}
    assert len(por_par) == 6


def test_blocos_zero_e_recusado():
    with pytest.raises(ValidationError):
        _gerar(
            DesignType.CENTRAL_COMPOSITE,
            DOIS_FATORES,
            {"ccd": {"variant": "face_centered"}},
            blocks=0,
            replicates=1,
        )


def test_um_bloco_replicates_dois_e_o_comportamento_anterior():
    """blocks=1, replicates=2: 2 cópias, bloco 1, réplicas 1 e 2 (sem mudança)."""
    design = _gerar(
        DesignType.CENTRAL_COMPOSITE,
        DOIS_FATORES,
        {"ccd": {"variant": "face_centered"}},
        blocks=1,
        replicates=2,
    )
    assert {r.block for r in design.runs} == {1}
    assert sorted({r.replicate for r in design.runs}) == [1, 2]


def test_std_order_unico_e_run_order_e_permutacao_com_blocos_intercalados():
    """std_order único de 1 a N; run_order permutação de 1 a N; blocos intercalados."""
    design = _tres_ao_quadrado(blocks=7, replicates=1, seed=42)
    n = len(design.runs)
    assert sorted(r.std_order for r in design.runs) == list(range(1, n + 1))
    assert sorted(r.run_order for r in design.runs) == list(range(1, n + 1))

    por_ordem = sorted(design.runs, key=lambda r: r.run_order)
    metade = n // 2
    primeira_metade = {r.block for r in por_ordem[:metade]}
    # Se os blocos saíssem em sequência na bancada, a primeira metade da
    # ordem de execução seria toda de um único bloco.
    assert len(primeira_metade) > 1


def test_blocos_intercalados_tambem_no_2k_que_expande_replicas_internamente():
    """A armadilha do 2^k: blocos aplicados por fora não podem virar sequência."""
    design = _gerar(
        DesignType.FULL_FACTORIAL_2K,
        DOIS_FATORES,
        {},
        blocks=4,
        replicates=1,
        seed=11,
    )
    assert sorted({r.block for r in design.runs}) == [1, 2, 3, 4]
    n = len(design.runs)
    assert sorted(r.run_order for r in design.runs) == list(range(1, n + 1))
    por_ordem = sorted(design.runs, key=lambda r: r.run_order)
    metade = n // 2
    primeira_metade = {r.block for r in por_ordem[:metade]}
    assert len(primeira_metade) > 1


def test_replicas_dentro_do_2k_nao_sao_duplicadas_pelo_bloco_externo():
    """A armadilha do enunciado: blocks=3 não pode also multiplicar réplicas."""
    sem_bloco = _gerar(DesignType.FULL_FACTORIAL_2K, DOIS_FATORES, {}, 1, 2)
    com_bloco = _gerar(DesignType.FULL_FACTORIAL_2K, DOIS_FATORES, {}, 3, 2)
    assert len(com_bloco.runs) == 3 * len(sem_bloco.runs)
    assert sorted({r.replicate for r in com_bloco.runs}) == [1, 2]
    assert sorted({r.block for r in com_bloco.runs}) == [1, 2, 3]


def test_replicas_dentro_do_fracionado_nao_sao_duplicadas_pelo_bloco_externo():
    seis_fatores = [
        {
            "name": nome,
            "factor_type": "quantitative",
            "unit": "%",
            "low": 1.0,
            "high": 3.0,
        }
        for nome in ("A", "B", "C", "D", "E", "F")
    ]
    extra = {"fractional": {"resolution": 4}}
    sem_bloco = _gerar(
        DesignType.FRACTIONAL_FACTORIAL_2KP, seis_fatores, extra, 1, 2
    )
    com_bloco = _gerar(
        DesignType.FRACTIONAL_FACTORIAL_2KP, seis_fatores, extra, 3, 2
    )
    assert len(com_bloco.runs) == 3 * len(sem_bloco.runs)
    assert sorted({r.replicate for r in com_bloco.runs}) == [1, 2]
    assert sorted({r.block for r in com_bloco.runs}) == [1, 2, 3]

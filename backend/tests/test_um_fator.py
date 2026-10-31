"""1 fator em blocos passa a gerar (fix "vitrine só oferece o gerável").

Caso motivador real: um pesquisador declarou, no ``/setup``, uma entrada como
BLOCO com 4 categorias (Tucum, Piassava, Buriti, Juta) e UM fator quantitativo
em 3 níveis (% de fibra: 0, 2, 4). Isso é um RCBD: 3 × 4 = 12 ensaios. Ao
clicar em gerar, o motor recusava com "Um fatorial completo com níveis precisa
de pelo menos 2 fatores." -- mas o desenho é legítimo: um fator em blocos
completos casualizados é o exemplo de abertura da Seção 9 do Caderno 1 (os
cinco pares arma-radar são um fator em dois níveis dentro de cinco blocos, já
golden em ``test_blocks_rcbd.py``). A análise já sabia fazer essa conta; só a
geração recusava.

``full_factorial_2k`` e ``full_factorial_general`` passam a aceitar k=1 (ver
os guards em ``services/design_service.build_2k_design`` e
``services/design_builders.build_general_factorial_design``). As demais sete
famílias continuam recusando com 1 fator -- ali a exigência de 2+/3+ é
geométrica de verdade (uma fração precisa de pelo menos 2 colunas para
confundir, um Box-Behnken precisa de 3 fatores para desenhar as faces do
cubo, etc.), e ``test_minimos_por_familia.py`` é o teste de contrato que
cobre as nove famílias juntas.
"""

from __future__ import annotations

import numpy as np
import pytest

from domain.errors import DesignConfigError
from domain.schemas import DesignGenerateRequest
from domain.types import DesignType
from services import design_service


def _quant(nome: str, baixo: float, alto: float, levels: list[float] | None = None) -> dict:
    d: dict = {"name": nome, "factor_type": "quantitative", "unit": "%", "low": baixo, "high": alto}
    if levels is not None:
        d["levels"] = levels
    return d


RESPOSTAS = [{"name": "MR", "unit": "MPa"}]


def _gerar(tipo: DesignType, fatores: list[dict], extra: dict | None = None, **kwargs):
    corpo = {
        "name": "um fator",
        "design_type": tipo.value,
        "factors": fatores,
        "responses": RESPOSTAS,
        "seed": 7,
    }
    corpo.update(extra or {})
    corpo.update(kwargs)
    return design_service._build_design(DesignGenerateRequest.model_validate(corpo))


# --- o caso real do pesquisador -----------------------------------------------


def test_caso_real_fibra_3_niveis_4_blocos_da_12_ensaios():
    """% de fibra em [0, 2, 4], bloco = tipo de fibra (4 categorias) -> 12 ensaios."""
    design = _gerar(
        DesignType.FULL_FACTORIAL_GENERAL,
        [_quant("% de fibra", 0.0, 4.0, levels=[0.0, 2.0, 4.0])],
        blocks=4,
        replicates=1,
    )
    assert len(design.runs) == 12
    assert sorted({r.block for r in design.runs}) == [1, 2, 3, 4]

    por_bloco: dict[int, list[float]] = {}
    for run in design.runs:
        por_bloco.setdefault(run.block, []).append(run.cells["% de fibra"].natural)
    assert sorted(por_bloco.keys()) == [1, 2, 3, 4]
    for bloco, naturais in por_bloco.items():
        assert sorted(naturais) == [0.0, 2.0, 4.0], f"bloco {bloco}: {naturais}"


def test_caso_real_modelo_linear_quadratico_e_estimavel_com_6_gl():
    """Sobre os 12 ensaios: intercepto + z + z^2 + 3 indicadoras de bloco = 6
    parâmetros, posto 6, 6 GL de resíduo (12 - 6)."""
    design = _gerar(
        DesignType.FULL_FACTORIAL_GENERAL,
        [_quant("% de fibra", 0.0, 4.0, levels=[0.0, 2.0, 4.0])],
        blocks=4,
        replicates=1,
    )
    runs = sorted(design.runs, key=lambda r: r.std_order)
    z = np.array([r.cells["% de fibra"].coded for r in runs])
    blocos = np.array([r.block for r in runs])

    n = len(runs)
    cols = [np.ones(n), z, z**2]
    # 3 indicadoras de bloco (dummy do bloco 2, 3, 4; bloco 1 é a referência).
    for b in (2, 3, 4):
        cols.append((blocos == b).astype(float))
    x = np.column_stack(cols)

    assert x.shape == (12, 6)
    rank = int(np.linalg.matrix_rank(x))
    assert rank == x.shape[1] == 6
    df_resid = n - rank
    assert df_resid == 6


# --- 1 fator em 2 níveis (full_factorial_2k) ----------------------------------


def test_um_fator_dois_niveis_da_2_ensaios():
    design = _gerar(DesignType.FULL_FACTORIAL_2K, [_quant("A", 0.0, 1.0)])
    assert len(design.runs) == 2


def test_um_fator_dois_niveis_com_5_blocos_da_10_ensaios_estrutura_armaradar():
    """5 blocos de 1 fator em 2 níveis: a mesma estrutura do arma-radar (10
    ensaios, 5 blocos), agora alcançável direto pela geração."""
    design = _gerar(DesignType.FULL_FACTORIAL_2K, [_quant("A", 0.0, 1.0)], blocks=5, replicates=1)
    assert len(design.runs) == 10
    assert sorted({r.block for r in design.runs}) == [1, 2, 3, 4, 5]
    por_bloco: dict[int, int] = {}
    for run in design.runs:
        por_bloco[run.block] = por_bloco.get(run.block, 0) + 1
    assert set(por_bloco.values()) == {2}


# --- sem bloco e sem réplica: satura, mas gera sem erro -----------------------


def test_um_fator_sem_bloco_sem_replica_gera_sem_erro():
    """3 ensaios (1 fator, 3 níveis), sem bloco/réplica: satura (0 GL de
    resíduo para linear+quadrático), mas quem recusa isso é o guard de
    estimabilidade da análise (ADR-007), não a geração."""
    design = _gerar(
        DesignType.FULL_FACTORIAL_GENERAL,
        [_quant("% de fibra", 0.0, 4.0, levels=[0.0, 2.0, 4.0])],
    )
    assert len(design.runs) == 3
    assert {r.block for r in design.runs} == {1}
    assert {r.replicate for r in design.runs} == {1}


# --- as famílias que continuam exigindo 2 ou 3 seguem recusando --------------


@pytest.mark.parametrize(
    ("tipo", "extra", "mensagem"),
    [
        (
            DesignType.FRACTIONAL_FACTORIAL_2KP,
            {"fractional": {"resolution": 3}},
            "planejamento fracionado",
        ),
        (DesignType.CENTRAL_COMPOSITE, {}, "CCD"),
        (DesignType.PLACKETT_BURMAN, {}, "Plackett-Burman"),
        (
            DesignType.OPTIMAL,
            {"optimal": {"criterion": "D", "model": "linear_quadratic", "n_runs": 10}},
            "ótimo",
        ),
        (DesignType.DSD, {}, "DSD"),
    ],
    ids=[f.value for f in (
        DesignType.FRACTIONAL_FACTORIAL_2KP,
        DesignType.CENTRAL_COMPOSITE,
        DesignType.PLACKETT_BURMAN,
        DesignType.OPTIMAL,
        DesignType.DSD,
    )],
)
def test_familias_de_minimo_2_continuam_recusando_1_fator(tipo, extra, mensagem):
    with pytest.raises(DesignConfigError, match=mensagem):
        _gerar(tipo, [_quant("A", 0.0, 1.0)], extra)


def test_box_behnken_continua_recusando_2_fatores():
    with pytest.raises(DesignConfigError, match="Box-Behnken"):
        _gerar(DesignType.BOX_BEHNKEN, [_quant("A", 0.0, 1.0), _quant("B", 0.0, 1.0)])

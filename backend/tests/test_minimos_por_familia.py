"""Teste de contrato: o número mínimo de fatores de cada família de geração.

Existiam TRÊS listas de mínimos desalinhadas no projeto (a geração recusava um
número, a vitrine oferecia outro, e a análise aceitava um terceiro) -- foi
isso que fez a interface oferecer planos que o motor recusava (o caso real: 1
fator quantitativo + bloco, oferecido pela vitrine, recusado por
``full_factorial_general``). Este arquivo fixa a tabela do lado do motor, uma
família por vez, parametrizado, para que uma mudança futura em qualquer
mínimo apareça aqui como teste quebrado em vez de divergência silenciosa.

A tabela, depois do fix desta lane (1 fator em blocos vira RCBD legítimo em
``full_factorial_2k``/``full_factorial_general``; ver ``test_um_fator.py``):

    full_factorial_2k          1
    full_factorial_general     1
    fractional_factorial_2kp   2
    central_composite          2
    box_behnken                3
    plackett_burman            2
    optimal                    2
    dsd                        2
    taguchi                    1

ESPELHO OBRIGATÓRIO: esta mesma tabela é reproduzida no frontend em
``frontend/src/domain/limitesFamilia.ts`` (outro agente está criando esse
arquivo nesta mesma lane, em paralelo). As duas listas PRECISAM concordar --
se você mudar um mínimo aqui, mude lá também, e vice-versa. É exatamente a
divergência entre essas duas listas (mais uma terceira, agora removida) que
motivou este teste existir.
"""

from __future__ import annotations

import pytest

from domain.errors import DesignConfigError
from domain.schemas import DesignGenerateRequest
from domain.types import DesignType
from services import design_service


def _quant(nome: str, baixo: float = 0.0, alto: float = 1.0) -> dict:
    return {"name": nome, "factor_type": "quantitative", "unit": "%", "low": baixo, "high": alto}


RESPOSTAS = [{"name": "MR", "unit": "MPa"}]


def _gerar(tipo: DesignType, n_fatores: int, extra: dict | None = None):
    letras = "ABCDEFGH"
    fatores = [_quant(letras[i]) for i in range(n_fatores)]
    corpo = {
        "name": "minimos",
        "design_type": tipo.value,
        "factors": fatores,
        "responses": RESPOSTAS,
        "seed": 7,
    }
    corpo.update(extra or {})
    return design_service._build_design(DesignGenerateRequest.model_validate(corpo))


# (design_type, mínimo de fatores, config extra para atingir o mínimo)
_MINIMO_POR_FAMILIA = [
    (DesignType.FULL_FACTORIAL_2K, 1, {}),
    (DesignType.FULL_FACTORIAL_GENERAL, 1, {}),
    (DesignType.FRACTIONAL_FACTORIAL_2KP, 2, {"fractional": {"generators": "a b"}}),
    (DesignType.CENTRAL_COMPOSITE, 2, {"ccd": {"variant": "face_centered"}}),
    (DesignType.BOX_BEHNKEN, 3, {}),
    (DesignType.PLACKETT_BURMAN, 2, {}),
    (
        DesignType.OPTIMAL,
        2,
        {"optimal": {"criterion": "D", "model": "linear_quadratic", "n_runs": 10}},
    ),
    (DesignType.DSD, 2, {}),
    (DesignType.TAGUCHI, 1, {}),
]

# Config extra usada no caso "um a menos que o mínimo" -- só importa para as
# famílias fracionadas/ótimas cujo builder valida a config ANTES de contar
# fatores (ver design_builders.build_fractional_design / build_optimal_design:
# o "cfg is None" checa primeiro, senão a mensagem de erro seria sobre a
# config em vez do número de fatores). Qualquer config validamente formada
# serve, pois o guard de fatores dispara antes de ela ser usada.
_EXTRA_PARA_UM_A_MENOS = {
    DesignType.FRACTIONAL_FACTORIAL_2KP: {"fractional": {"resolution": 3}},
    DesignType.OPTIMAL: {
        "optimal": {"criterion": "D", "model": "linear_quadratic", "n_runs": 10}
    },
}

_FAMILIAS_SEM_CASO_NEGATIVO = {
    DesignType.FULL_FACTORIAL_2K,
    DesignType.FULL_FACTORIAL_GENERAL,
    DesignType.TAGUCHI,
}


@pytest.mark.parametrize(
    ("tipo", "minimo", "extra"),
    _MINIMO_POR_FAMILIA,
    ids=[f[0].value for f in _MINIMO_POR_FAMILIA],
)
def test_no_minimo_a_geracao_funciona(tipo, minimo, extra):
    design = _gerar(tipo, minimo, extra)
    assert len(design.runs) > 0


@pytest.mark.parametrize(
    ("tipo", "minimo", "extra"),
    [f for f in _MINIMO_POR_FAMILIA if f[0] not in _FAMILIAS_SEM_CASO_NEGATIVO],
    ids=[f[0].value for f in _MINIMO_POR_FAMILIA if f[0] not in _FAMILIAS_SEM_CASO_NEGATIVO],
)
def test_um_a_menos_que_o_minimo_e_recusado(tipo, minimo, extra):
    """Para as famílias cujo mínimo é 2 ou 3, um fator a menos precisa recusar.

    Não parametrizado para ``full_factorial_2k``, ``full_factorial_general`` e
    ``taguchi`` (mínimo 1): não existe "um fator a menos" que 1, e forçar 0
    fatores bateria na validação do PRÓPRIO schema (``DesignGenerateRequest``
    exige ``factors`` com pelo menos 1 item) -- um ``pydantic.ValidationError``
    antes mesmo de chegar ao builder, não o ``DesignConfigError`` de domínio
    que este teste de contrato verifica. Essas três famílias entram só no
    teste positivo acima ("no mínimo funciona").
    """
    extra_negativo = _EXTRA_PARA_UM_A_MENOS.get(tipo, extra)
    with pytest.raises(DesignConfigError):
        _gerar(tipo, minimo - 1, extra_negativo)


def test_a_tabela_cobre_as_nove_familias_geraveis():
    """Trava a lista em si: nove famílias, nem mais nem menos.

    ``retrospective`` fica de fora -- não é gerada, é materializada a partir
    de uma tabela já colada (não tem "mínimo de fatores para gerar").
    """
    tipos = {f[0] for f in _MINIMO_POR_FAMILIA}
    assert len(tipos) == 9
    geraveis = {t for t in DesignType if t is not DesignType.RETROSPECTIVE}
    assert tipos == geraveis

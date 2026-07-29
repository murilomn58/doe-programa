"""Nome do agrupamento ("Tipo de solo") chegando ate a linha da ANOVA.

Reusa o mesmo golden ``armaradar`` (5 blocos) de ``test_blocks_rcbd.py``, so
que passando ``block_name`` explicito para ``AnalysisService.analyze``.
Cobre:

1. a linha agregada sai como "Bloco (Tipo de solo)" em vez de so "Bloco";
2. os graus de liberdade continuam k-1 (4, com 5 blocos) -- o nome não mexe
   na agregacao numerica, so no rotulo;
3. sem ``block_name`` (default), o comportamento antigo se mantem intacto
   ("Bloco" puro) -- e o que os goldens ja travam;
4. a regra do advisor que casa por substring (``"Bloco" in source``) continua
   disparando o comentario de blocos e continua excluindo a linha de bloco da
   lista de efeitos significativos, mesmo com o nome anexado.
"""

from __future__ import annotations

from domain.models import Experiment, Factor, Level, Response, Run
from domain.types import RSMModel
from services import advisor_service
from services.analysis_service import AnalysisService

# mesmos 10 valores de tests/test_blocks_rcbd.py (armaradar, 5 blocos)
DADOS_ARMARADAR = [
    (377.0, 362.0),
    (385.0, 369.0),
    (407.0, 410.0),
    (483.0, 470.0),
    (505.0, 489.0),
]


class FakeRepo:
    def __init__(self, experiment, factors, responses, runs):
        self._e, self._f, self._r, self._runs = experiment, factors, responses, runs

    async def get_experiment(self, experiment_id):
        return self._e

    async def get_factors(self, experiment_id):
        return self._f

    async def get_responses(self, experiment_id):
        return self._r

    async def get_runs(self, experiment_id):
        return self._runs


def _factor_armaradar() -> Factor:
    return Factor(
        name="ArmaRadar",
        factor_type="qualitative",
        unit="m/s",
        position=0,
        levels=[
            Level(coded_value=-1, natural_value=None, label="Arma-radar 2"),
            Level(coded_value=1, natural_value=None, label="Arma-radar 1"),
        ],
    )


def _run(i: int, coded: float, block: int, y: float) -> Run:
    return Run(
        run_order=i,
        std_order=i,
        point_type=1,
        block=block,
        replicate=1,
        cells={"ArmaRadar": {"coded": coded, "natural": coded, "label": None}},
        response_values={"Velocidade": y},
    )


def _runs_armaradar_blocados() -> list[Run]:
    runs: list[Run] = []
    i = 1
    for fabricante, (v1, v2) in enumerate(DADOS_ARMARADAR, start=1):
        runs.append(_run(i, 1.0, fabricante, v1))
        i += 1
        runs.append(_run(i, -1.0, fabricante, v2))
        i += 1
    return runs


async def _analisar(*, block_name: str | None):
    repo = FakeRepo(
        Experiment(name="armaradar-rcbd-nomeado"),
        [_factor_armaradar()],
        [Response(name="Velocidade", position=0, unit="m/s")],
        _runs_armaradar_blocados(),
    )
    return await AnalysisService(repo).analyze(
        1, "Velocidade", RSMModel.LINEAR, block_name=block_name
    )


async def test_bloco_com_nome_do_agrupamento():
    """block_name="Tipo de solo" -> a linha sai como "Bloco (Tipo de solo)"."""
    res = await _analisar(block_name="Tipo de solo")

    bloco_rows = [row for row in res.anova if row.source == "Bloco (Tipo de solo)"]
    assert len(bloco_rows) == 1
    assert bloco_rows[0].df == 4  # k-1 com 5 blocos, igual ao golden sem nome
    assert bloco_rows[0].f is not None and bloco_rows[0].p is not None
    # nenhuma linha solta "Bloco 2".."Bloco 5" nem a variante sem nome.
    assert not any(row.source == "Bloco" for row in res.anova)
    assert not any(
        row.source != "Bloco (Tipo de solo)" and "Bloco" in row.source for row in res.anova
    )


async def test_bloco_sem_nome_preserva_comportamento_antigo():
    """Default (sem block_name) continua produzindo "Bloco" puro."""
    res = await _analisar(block_name=None)
    bloco_rows = [row for row in res.anova if row.source == "Bloco"]
    assert len(bloco_rows) == 1
    assert bloco_rows[0].df == 4


async def test_advisor_continua_casando_com_bloco_nomeado():
    """A regra por substring ("Bloco" in source) do advisor_service dispara
    igual com "Bloco (Tipo de solo)": o comentario de blocos aparece e a
    linha de bloco continua fora da lista de efeitos significativos."""
    res = await _analisar(block_name="Tipo de solo")

    bloco_row = next(row for row in res.anova if row.source == "Bloco (Tipo de solo)")
    result_dict = {
        "model": "linear",
        "estimable": True,
        "saturated": False,
        "r_squared": res.r_squared,
        "stats": {"predicted_r_squared": None},
        "effects": [
            {"term": e.term, "p": e.p} for e in res.effects
        ],
        "anova": [{"source": row.source, "p": row.p} for row in res.anova],
        "curvature": None,
        "lack_of_fit": None,
    }
    design_meta = {
        "has_center": False,
        "has_axial": False,
        "max_replicate": 1,
        "all_quantitative": False,
        "n_runs_measured": 10,
        "n_blocks": 5,
    }
    advice = advisor_service.advise(result_dict, design_meta)

    # comentário "Blocos" disparou (a linha "Bloco (Tipo de solo)" foi achada).
    assert any(c["topic"] == "Blocos" for c in advice["comments"])
    # o termo de bloco nunca aparece entre os efeitos significativos/ns:
    # a regra de exclusão por substring também casou com o nome anexado.
    assert bloco_row.source not in [
        s["title"] for s in advice["suggestions"]
    ]  # sanity: bloco não vira sugestão de efeito

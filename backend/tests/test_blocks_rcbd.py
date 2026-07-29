"""Golden do fix "3+ blocos deixam de ser ignorados em silêncio" (2026-07).

Não existe fixture pronta de RCBD (a auditoria dizia que existia -- não existe,
ver docs/adp/auditoria-aulas-2026-07.md). O dado verificado que serve de golden
é a entrada ``armaradar`` de ``apostilas/dados/numeros.md`` (fonte: prof.
Peixoto, Capítulos 1 e 2, p. 47-53): cinco pares de fabricante (bloco), um
fator (conjunto arma-radar) em dois níveis, dez valores medidos. É um RCBD com
5 blocos, e o teste pareado clássico é algebricamente equivalente à ANOVA com
bloco -- exatamente o caso que a análise ignorava em silêncio com 3+ blocos.

Os ensaios são montados À MÃO (como ``test_blocks_curvature.py`` faz com o
helper ``_run``), sem passar pela geração: ``armaradar`` tem um fator só e a
geração de planejamento exige dois.
"""

from __future__ import annotations

import math

import pytest
from scipy import stats as scipy_stats

from domain.models import Experiment, Factor, Level, Response, Run
from domain.types import RSMModel
from services.analysis_service import AnalysisService

# --- dados verificados (apostilas/dados/numeros.md, seção 11 `armaradar`) ----
# (arma-radar 1, arma-radar 2) por fabricante, m/s.
DADOS_ARMARADAR = [
    (377.0, 362.0),  # fabricante 1
    (385.0, 369.0),  # fabricante 2
    (407.0, 410.0),  # fabricante 3
    (483.0, 470.0),  # fabricante 4
    (505.0, 489.0),  # fabricante 5
]

EFEITO_ESPERADO = 11.4  # média(arma-radar 1) - média(arma-radar 2) = 431.4 - 420.0

# Com blocagem (pareado, 4 GL): S (desvio-padrão das diferenças) = 8.142481.
S_COM_BLOCO = 8.142481
DF_COM_BLOCO = 4
TCRIT_COM_BLOCO = 2.776445
SEMI_AMPLITUDE_COM_BLOCO = 10.1102  # 11.4 +- 10.11 (numeros.md escreve 10,11)

# Sem blocagem (duas amostras, 8 GL): S (desvio pooled) = 58.216407.
S_SEM_BLOCO = 58.216407
DF_SEM_BLOCO = 8
TCRIT_SEM_BLOCO = 2.306004
SEMI_AMPLITUDE_SEM_BLOCO = 84.9054  # 11.4 +- 84.91 (numeros.md escreve 84,91)


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
    """Fator qualitativo de 2 níveis: qual conjunto arma-radar mediu a velocidade."""
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


def _runs_armaradar(*, blocked: bool) -> list[Run]:
    """Monta os 10 ensaios a mao: coded=+1 -> arma-radar 1, coded=-1 -> arma-radar 2.

    ``blocked=True``: block = numero do fabricante (1..5), um RCBD de 5 blocos.
    ``blocked=False``: block = 1 para todos os 10 ensaios (a analise entao NAO
    injeta nenhum termo de bloco: len(distinct_blocks) == 1).
    """
    runs: list[Run] = []
    i = 1
    for fabricante, (v1, v2) in enumerate(DADOS_ARMARADAR, start=1):
        block = fabricante if blocked else 1
        runs.append(_run(i, 1.0, block, v1))
        i += 1
        runs.append(_run(i, -1.0, block, v2))
        i += 1
    return runs


async def _analisar(runs: list[Run]):
    repo = FakeRepo(
        Experiment(name="armaradar-rcbd"),
        [_factor_armaradar()],
        [Response(name="Velocidade", position=0, unit="m/s")],
        runs,
    )
    return await AnalysisService(repo).analyze(1, "Velocidade", RSMModel.LINEAR)


def _effect_row(res, name: str = "ArmaRadar"):
    return next(e for e in res.effects if e.term == name)


async def test_armaradar_com_5_blocos_reproduz_intervalo_pareado():
    """RCBD de 5 blocos (um por fabricante): efeito 11,4 +- 10,11 com 4 GL.

    Valida de uma vez: blocagem com mais de 2 blocos (o defeito corrigido),
    a agregacao das k-1 linhas de bloco da ANOVA numa unica linha "Bloco" com
    4 GL, e a coerencia com o teste pareado da Tabela 6 / p.53 do Caderno 1.
    """
    res = await _analisar(_runs_armaradar(blocked=True))
    assert res.estimable is True
    assert res.stats is not None
    assert res.stats.df_resid == DF_COM_BLOCO

    eff = _effect_row(res)
    assert eff.effect == pytest.approx(EFEITO_ESPERADO, abs=1e-9)

    # SE do efeito == SE da diferença pareada (S_d / sqrt(n)) -- a equivalência
    # algébrica entre o teste pareado e a ANOVA com bloco.
    se_pareado = S_COM_BLOCO / math.sqrt(5)
    assert eff.std_err == pytest.approx(se_pareado, abs=5e-5)

    tcrit = float(scipy_stats.t.ppf(0.975, DF_COM_BLOCO))
    assert tcrit == pytest.approx(TCRIT_COM_BLOCO, abs=5e-6)
    margem = tcrit * eff.std_err
    assert margem == pytest.approx(SEMI_AMPLITUDE_COM_BLOCO, abs=5e-4)
    assert eff.ci_low == pytest.approx(EFEITO_ESPERADO - SEMI_AMPLITUDE_COM_BLOCO, abs=5e-4)
    assert eff.ci_high == pytest.approx(EFEITO_ESPERADO + SEMI_AMPLITUDE_COM_BLOCO, abs=5e-4)

    # ANOVA: uma única linha "Bloco" (agregada de 4 termos indicadores 1 GL
    # cada), com 4 GL no total -- não seis (k-1=4) linhas soltas "Bloco 2".."5".
    bloco_rows = [row for row in res.anova if row.source == "Bloco"]
    assert len(bloco_rows) == 1
    assert bloco_rows[0].df == DF_COM_BLOCO
    assert bloco_rows[0].f is not None and bloco_rows[0].p is not None
    assert not any(row.source != "Bloco" and "Bloco" in row.source for row in res.anova)


async def test_armaradar_sem_blocagem_reproduz_intervalo_duas_amostras():
    """Mesmos 10 valores, todos no bloco 1: efeito 11,4 +- 84,91 com 8 GL.

    Sem reconhecer o fabricante como bloco a variabilidade entre fabricantes
    (377 a 505 m/s) engole a diferenca de 11,4 m/s: o intervalo passa a
    conter zero. Nenhum termo "Bloco" deve aparecer (len(distinct_blocks)==1
    nao injeta nada).
    """
    res = await _analisar(_runs_armaradar(blocked=False))
    assert res.estimable is True
    assert res.stats is not None
    assert res.stats.df_resid == DF_SEM_BLOCO

    eff = _effect_row(res)
    assert eff.effect == pytest.approx(EFEITO_ESPERADO, abs=1e-9)

    se_duas_amostras = S_SEM_BLOCO * math.sqrt(1 / 5 + 1 / 5)
    assert eff.std_err == pytest.approx(se_duas_amostras, abs=5e-5)

    tcrit = float(scipy_stats.t.ppf(0.975, DF_SEM_BLOCO))
    assert tcrit == pytest.approx(TCRIT_SEM_BLOCO, abs=5e-6)
    margem = tcrit * eff.std_err
    assert margem == pytest.approx(SEMI_AMPLITUDE_SEM_BLOCO, abs=5e-4)
    assert eff.ci_low == pytest.approx(EFEITO_ESPERADO - SEMI_AMPLITUDE_SEM_BLOCO, abs=5e-4)
    assert eff.ci_high == pytest.approx(EFEITO_ESPERADO + SEMI_AMPLITUDE_SEM_BLOCO, abs=5e-4)

    # sem blocagem: nenhuma linha de bloco na ANOVA.
    assert not any("Bloco" in row.source for row in res.anova)

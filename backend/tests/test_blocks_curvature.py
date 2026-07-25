"""Golden tests dos 2 gaps fechados na auditoria 2026-07:

1. BLOCOS na análise: com 2 blocos, o termo "Bloco" entra no modelo (como o
   OriginPro). Dataset equivalente por estatísticas suficientes reproduz o
   relatório 'Doe ANalysis pra superficie d resposta.pdf' número a número.
2. CURVATURA via pontos centrais (fórmula da aula Cap.4 Parte 4), calculada
   pela AnalysisService quando o modelo não tem termos quadráticos.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import pytest

from domain.models import Experiment, Factor, Level, Response, Run
from domain.types import RSMModel
from services.analysis_service import AnalysisService

FIX = Path(__file__).parent / "audit" / "fixtures"
ALPHA = 1.414  # detectado na auditoria: OriginPro usou raiz(2) truncada


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


def _factor(name: str, position: int) -> Factor:
    return Factor(
        name=name,
        factor_type="quantitative",
        unit="%",
        position=position,
        levels=[
            Level(coded_value=-1, natural_value=1.0, label=None),
            Level(coded_value=1, natural_value=5.0, label=None),
        ],
    )


def _run(i: int, fib: float, cem: float, block: int, y: float) -> Run:
    to_nat = lambda c: 3.0 + 2.0 * c
    return Run(
        run_order=i,
        std_order=i,
        point_type=0 if fib == 0 and cem == 0 else 1,
        block=block,
        replicate=1,
        cells={
            "Fiber": {"coded": fib, "natural": to_nat(fib), "label": None},
            "Cement": {"coded": cem, "natural": to_nat(cem), "label": None},
        },
        response_values={"DP": y},
    )


def _ccd_equivalente() -> list[Run]:
    """Reconstrói um dataset com as MESMAS estatísticas suficientes do relatório
    OriginPro (coefs, SS_LoF, SS_PE) — invariância do OLS garante o mesmo output."""
    fx = json.loads((FIX / "originpro_ccd_blocks.json").read_text(encoding="utf-8"))
    r = fx["relatorio"]

    pts = []  # (fiber, cement, block+-1)
    for s1, s2 in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        pts.append((float(s1), float(s2), -1.0))  # bloco 1 (fatorial) -> -1
    for s1, s2 in ((-ALPHA, 0), (ALPHA, 0), (0, -ALPHA), (0, ALPHA)):
        pts.append((float(s1), float(s2), 1.0))  # bloco 2 (axial) -> +1
    pts += [(0.0, 0.0, -1.0)] * 3  # centrais do bloco 1
    pts += [(0.0, 0.0, 1.0)] * 3   # centrais do bloco 2

    X = np.array([[1.0, b, f, c] for f, c, b in pts])
    beta = np.array([r["intercepto"], r["coef_blocks"], r["coef_fiber"], r["coef_cement"]])

    # componente de erro puro: {-d, 0, +d} em cada grupo de 3 centrais
    d = math.sqrt(r["pure_error"]["ss"] / 4.0)
    e_pe = np.zeros(14)
    e_pe[8:11] = (-d, 0.0, d)
    e_pe[11:14] = (-d, 0.0, d)

    # componente de falta de ajuste: constante nos grupos de réplica, ortogonal a X
    G = np.zeros((14, 10))  # indicadoras dos 10 grupos (8 únicos + 2 centrais)
    for i in range(8):
        G[i, i] = 1.0
    G[8:11, 8] = 1.0
    G[11:14, 9] = 1.0
    P = X @ np.linalg.solve(X.T @ X, X.T)
    R = G - P @ G  # projeção do span dos grupos fora de X
    q, _ = np.linalg.qr(R)
    # primeira direção não-nula ortogonal a X e constante nos grupos
    v = None
    for j in range(q.shape[1]):
        cand = q[:, j]
        if np.linalg.norm(cand) > 1e-8 and np.max(np.abs(X.T @ cand)) < 1e-8:
            v = cand
            break
    assert v is not None
    e_lof = v * math.sqrt(r["lack_of_fit"]["ss"])

    y = X @ beta + e_lof + e_pe
    return [
        _run(i + 1, f, c, 1 if b < 0 else 2, float(y[i]))
        for i, (f, c, b) in enumerate(pts)
    ]


@pytest.fixture()
def fx_relatorio():
    return json.loads((FIX / "originpro_ccd_blocks.json").read_text(encoding="utf-8"))["relatorio"]


async def _analisar(runs, model=RSMModel.LINEAR):
    repo = FakeRepo(
        Experiment(name="ccd-blocos"),
        [_factor("Fiber", 0), _factor("Cement", 1)],
        [Response(name="DP", position=0, unit=None)],
        runs,
    )
    return await AnalysisService(repo).analyze(1, "DP", model)


async def test_ccd_blocos_reproduz_relatorio_originpro(fx_relatorio):
    r = fx_relatorio
    res = await _analisar(_ccd_equivalente())

    coefs = {c.term: c for c in res.coefficients}
    bloco = next(k for k in coefs if "Bloco" in k)
    fib = next(k for k in coefs if "Fiber" in k)
    cem = next(k for k in coefs if "Cement" in k)

    assert coefs[bloco].coef_coded == pytest.approx(r["coef_blocks"], abs=5e-6)
    assert coefs[fib].coef_coded == pytest.approx(r["coef_fiber"], abs=5e-6)
    assert coefs[cem].coef_coded == pytest.approx(r["coef_cement"], abs=5e-6)
    assert coefs[fib].std_err == pytest.approx(r["se_fiber"], abs=5e-5)
    assert coefs[bloco].std_err == pytest.approx(r["se_blocks"], abs=5e-5)
    assert coefs[fib].p == pytest.approx(r["p_fiber"], abs=5e-5)
    assert coefs[cem].p == pytest.approx(r["p_cement"], abs=5e-5)

    anova = {row.source: row for row in res.anova}
    b_row = next(v for k, v in anova.items() if "Bloco" in k)
    f_row = next(v for k, v in anova.items() if "Fiber" in k)
    c_row = next(v for k, v in anova.items() if "Cement" in k)
    assert b_row.ss == pytest.approx(r["anova"]["blocks"]["ss"], abs=5e-4)
    assert f_row.ss == pytest.approx(r["anova"]["fiber"]["ss"], abs=5e-3)
    assert f_row.f == pytest.approx(r["anova"]["fiber"]["f"], abs=5e-4)
    assert c_row.ss == pytest.approx(r["anova"]["cement"]["ss"], abs=5e-3)
    assert c_row.f == pytest.approx(r["anova"]["cement"]["f"], abs=5e-4)

    assert res.r_squared == pytest.approx(r["r2"], abs=5e-5)
    assert res.adj_r_squared == pytest.approx(r["r2_adj"], abs=5e-5)
    assert res.stats.rmse == pytest.approx(r["rmse"], abs=5e-5)
    assert res.stats.sse == pytest.approx(r["sse"], abs=5e-4)

    assert res.pure_error is not None and res.lack_of_fit is not None
    assert res.pure_error.ss == pytest.approx(r["pure_error"]["ss"], abs=5e-4)
    assert res.pure_error.df == r["pure_error"]["df"]
    assert res.lack_of_fit.ss == pytest.approx(r["lack_of_fit"]["ss"], abs=5e-4)
    assert res.lack_of_fit.df == r["lack_of_fit"]["df"]
    assert res.lack_of_fit.f == pytest.approx(r["lack_of_fit"]["f"], abs=5e-4)
    assert res.lack_of_fit.p == pytest.approx(r["lack_of_fit"]["p"], abs=5e-5)


async def test_curvatura_significativa_no_service():
    runs = []
    i = 1
    for s1, s2, y in ((-1, -1, 10.0), (1, -1, 12.0), (-1, 1, 11.0), (1, 1, 13.0)):
        runs.append(_run(i, float(s1), float(s2), 1, y)); i += 1
    for y in (20.0, 20.5, 19.5):
        runs.append(_run(i, 0.0, 0.0, 1, y)); i += 1

    res = await _analisar(runs)
    assert res.curvature is not None
    assert res.curvature.source == "Curvatura"
    assert res.curvature.ss == pytest.approx(4 * 3 * (8.5**2) / 7, abs=1e-9)
    assert res.curvature.f == pytest.approx(res.curvature.ss / 0.25, abs=1e-6)
    assert res.curvature.p < 0.05
    assert any("Curvatura significativa" in w for w in res.warnings)


async def test_curvatura_ausente_sem_centrais_e_em_modelo_quadratico():
    runs_sem_centro = []
    i = 1
    for s1, s2, y in ((-1, -1, 10.0), (1, -1, 12.0), (-1, 1, 11.0), (1, 1, 13.0),
                      (-1, -1, 10.2), (1, -1, 12.1), (-1, 1, 10.9), (1, 1, 13.2)):
        runs_sem_centro.append(_run(i, float(s1), float(s2), 1, y)); i += 1
    res = await _analisar(runs_sem_centro)
    assert res.curvature is None

    # CCD completo + modelo quadrático: curvatura já está no modelo -> None
    runs_ccd = _ccd_equivalente()
    res_q = await _analisar(runs_ccd, model=RSMModel.LINEAR_QUADRATIC)
    assert res_q.curvature is None

"""End-to-end HTTP tests for the retrospective endpoints.

``/diagnose`` is stateless (no DB). ``/materialize`` persists an experiment
whose shape is identical to a generated design — the acceptance criterion is
that the EXISTING ``POST /analysis`` runs on it unchanged and returns a valid
ANOVA. Fixture mirrors ``tests/test_analysis_api.py``.
"""

import numpy as np
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from pyDOE3 import ff2n
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from db import get_session
from domain.models import Base
from main import app

FACTORS_3 = [("A", 10.0, 30.0), ("B", 0.0, 100.0), ("C", 1.0, 5.0)]


def _natural(coded: float, low: float, high: float) -> float:
    return (low + high) / 2 + coded * (high - low) / 2


def _rows(matrix, factors, y=1.0):
    return [
        {
            "factors": {
                name: str(_natural(float(row[j]), low, high))
                for j, (name, low, high) in enumerate(factors)
            },
            "responses": {"Y": str(y + i)},
        }
        for i, row in enumerate(matrix)
    ]


@pytest_asyncio.fixture
async def client() -> AsyncClient:
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    test_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async def override_get_session():
        async with test_session() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_session] = override_get_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client
    app.dependency_overrides.clear()
    await engine.dispose()


def _diagnose_body(matrix, factors):
    return {
        "factors": [{"name": n} for n, _, _ in factors],
        "responses": [{"name": "Y"}],
        "rows": _rows(matrix, factors),
    }


# --- diagnose -----------------------------------------------------------------


async def test_diagnose_full_2cubed(client: AsyncClient) -> None:
    resp = await client.post("/retrospective/diagnose", json=_diagnose_body(ff2n(3), FACTORS_3))
    assert resp.status_code == 200
    body = resp.json()
    assert body["best_design"] == "full_factorial_2k"
    assert body["n_rows_valid"] == 8
    variants = {c["variant"] for c in body["completions"]}
    assert "face_centered" in variants  # CCD path offered for the quadratic model
    models = {m["model"]: m for m in body["models"]}
    assert models["linear"]["status"] == "estimable"
    assert models["linear_quadratic"]["status"] == "not_estimable"


async def test_diagnose_missing_two_corners_completion_lists_them(client: AsyncClient) -> None:
    matrix = np.delete(ff2n(3), [0, 7], axis=0)  # drop (-,-,-) and (+,+,+)
    resp = await client.post("/retrospective/diagnose", json=_diagnose_body(matrix, FACTORS_3))
    assert resp.status_code == 200
    body = resp.json()
    completion = next(c for c in body["completions"] if c["target"] == "full_factorial_2k")
    assert completion["n_runs_to_add"] == 2
    corners = sorted((r["A"], r["B"], r["C"]) for r in completion["runs_to_add"])
    assert corners == [(10.0, 0.0, 1.0), (30.0, 100.0, 5.0)]


async def test_diagnose_reports_row_issues(client: AsyncClient) -> None:
    body = _diagnose_body(ff2n(3), FACTORS_3)
    # Type A as quantitative so a non-numeric cell excludes the row (an "auto"
    # column would instead infer qualitative and accept "n/a" as a label).
    body["factors"][0]["factor_type"] = "quantitative"
    body["rows"].append({"factors": {"A": "n/a", "B": "0", "C": "1"}, "responses": {"Y": "9"}})
    resp = await client.post("/retrospective/diagnose", json=body)
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["n_rows"] == 9
    assert payload["n_rows_valid"] == 8
    assert len(payload["row_issues"]) == 1


# --- materialize + analysis (the acceptance criterion) ------------------------


def _materialize_body(matrix, factors, **extra):
    body = {
        "name": "retro 2^3",
        "factors": [{"name": n} for n, _, _ in factors],
        "responses": [{"name": "Y"}],
        "rows": _rows(matrix, factors),
    }
    body.update(extra)
    return body


async def test_materialize_then_analysis_runs(client: AsyncClient) -> None:
    mat = await client.post(
        "/retrospective/materialize", json=_materialize_body(ff2n(3), FACTORS_3)
    )
    assert mat.status_code == 200
    result = mat.json()
    assert result["design_type"] == "retrospective"
    assert result["n_runs"] == 8
    exp_id = result["experiment_id"]

    # The persisted experiment feeds the EXISTING analysis endpoint unchanged.
    analysis = await client.post(
        "/analysis",
        json={"experiment_id": exp_id, "response_name": "Y", "model": "linear"},
    )
    assert analysis.status_code == 200
    body = analysis.json()
    assert body["estimable"] is True
    assert {e["term"] for e in body["effects"]} == {"A", "B", "C"}
    assert body["anova"]  # a real ANOVA table came back


async def test_materialize_excludes_constant_factor(client: AsyncClient) -> None:
    body = _materialize_body(ff2n(3), FACTORS_3)
    for row in body["rows"]:
        row["factors"]["D"] = "7.5"  # constant column
    body["factors"].append({"name": "D"})
    resp = await client.post("/retrospective/materialize", json=body)
    assert resp.status_code == 200
    payload = resp.json()
    assert "D" in payload["excluded_constant_factors"]
    assert any("constante" in w.lower() for w in payload["warnings"])

    runs = (await client.get(f"/experiments/{payload['experiment_id']}/runs")).json()
    factor_names = {f["name"] for f in runs["factors"]}
    assert "D" not in factor_names  # constant excluded from the experiment


async def test_materialize_persists_response_values(client: AsyncClient) -> None:
    mat = await client.post(
        "/retrospective/materialize", json=_materialize_body(ff2n(3), FACTORS_3)
    )
    exp_id = mat.json()["experiment_id"]
    runs = (await client.get(f"/experiments/{exp_id}/runs")).json()["runs"]
    assert all("Y" in r["response_values"] for r in runs)
    assert all(r["response_values"]["Y"] is not None for r in runs)


async def test_materialize_append_runs_show_without_responses(client: AsyncClient) -> None:
    append = [{"A": 30.0, "B": 100.0, "C": 5.0}, {"A": 10.0, "B": 0.0, "C": 1.0}]
    mat = await client.post(
        "/retrospective/materialize",
        json=_materialize_body(ff2n(3), FACTORS_3, append_runs=append),
    )
    assert mat.status_code == 200
    result = mat.json()
    assert result["n_runs"] == 8 + 2  # extras included in the count
    exp_id = result["experiment_id"]

    runs = (await client.get(f"/experiments/{exp_id}/runs")).json()["runs"]
    assert len(runs) == 10
    # The two extra runs carry no measured response.
    without = [r for r in runs if not r["response_values"]]
    assert len(without) == 2


async def test_materialize_all_constant_is_422(client: AsyncClient) -> None:
    rows = [
        {"factors": {"A": "5", "B": "3"}, "responses": {"Y": "1"}},
        {"factors": {"A": "5", "B": "3"}, "responses": {"Y": "2"}},
    ]
    resp = await client.post(
        "/retrospective/materialize",
        json={
            "name": "flat",
            "factors": [{"name": "A"}, {"name": "B"}],
            "responses": [{"name": "Y"}],
            "rows": rows,
        },
    )
    assert resp.status_code == 422

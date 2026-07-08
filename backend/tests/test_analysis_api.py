"""End-to-end HTTP test for POST /analysis (router -> service -> repo -> DB).

Generates the class 2^2 design, saves the DP_50000 responses, runs the linear
analysis and checks the golden panel comes back through the API. Also checks the
estimability guard (quadratic model) and the 404/422 error paths.
"""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from db import get_session
from domain.models import Base
from main import app

# cond +1/-1, par +1/-1 mapped to the golden DP_50000 responses.
GOLDEN = [
    (1, -1, 3.475),
    (-1, -1, 0.612),
    (1, 1, 9.041),
    (-1, 1, 5.168),
    (-1, -1, 0.645),
    (1, -1, 1.623),
    (1, 1, 6.27),
    (-1, 1, 3.447),
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


async def _seed_golden(client: AsyncClient) -> int:
    """Create the 2^2 design (2 replicates) and fill DP_50000 with golden data."""
    gen = await client.post(
        "/designs/generate",
        json={
            "name": "aula 2^2",
            "replicates": 2,
            "seed": 1,
            "factors": [
                {"name": "cond", "factor_type": "quantitative", "low": 18, "high": 19},
                {"name": "par", "factor_type": "quantitative", "low": 70, "high": 210},
            ],
            "responses": [{"name": "DP_50000", "unit": "mm"}],
        },
    )
    assert gen.status_code == 201
    exp_id = gen.json()["experiment_id"]

    runs = (await client.get(f"/experiments/{exp_id}/runs")).json()["runs"]
    # Match each golden row to a run by its (cond, par) coded cell, consuming
    # one run per row so both replicates get filled.
    remaining = list(runs)
    values = []
    for cond, par, y in GOLDEN:
        idx = next(
            i
            for i, r in enumerate(remaining)
            if r["factors"]["cond"]["coded"] == cond
            and r["factors"]["par"]["coded"] == par
        )
        run = remaining.pop(idx)
        values.append({"run_id": run["id"], "response_name": "DP_50000", "value": str(y)})

    save = await client.post(f"/experiments/{exp_id}/runs/responses", json={"values": values})
    assert save.status_code == 200
    return exp_id


async def test_analysis_endpoint_reproduces_golden(client: AsyncClient) -> None:
    exp_id = await _seed_golden(client)
    resp = await client.post(
        "/analysis",
        json={"experiment_id": exp_id, "response_name": "DP_50000", "model": "linear"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["estimable"] is True
    assert body["saturated"] is False

    effects = {e["term"]: e for e in body["effects"]}
    assert effects["cond"]["effect"] == pytest.approx(2.634250, rel=1e-6)
    assert effects["par"]["effect"] == pytest.approx(4.392750, rel=1e-6)

    stats = body["stats"]
    assert stats["r_squared"] == pytest.approx(0.866924, rel=1e-6)
    assert stats["adj_r_squared"] == pytest.approx(0.813693, rel=1e-6)
    assert stats["press"] == pytest.approx(20.61956, rel=1e-6)
    assert stats["predicted_r_squared"] == pytest.approx(0.659325, rel=1e-6)
    # Pure Error / Lack-of-Fit split present (2 replicates -> df_PE=4, df_LOF=1)
    assert body["pure_error"]["df"] == 4
    assert body["lack_of_fit"]["df"] == 1

    # Plot arrays (issue 05) travel with the analysis, computed on the backend.
    plots = body["plots"]
    assert plots is not None
    assert plots["factor_pairs"] == [["cond", "par"]]
    assert plots["selected_pair"] == ["cond", "par"]
    assert plots["surface"]["factor_x"] == "cond"
    assert len(plots["surface"]["z"]) == len(plots["surface"]["x"])
    assert plots["pareto"]["terms"] == ["par", "cond"]
    assert plots["pareto"]["sig_line"] > 0
    assert plots["obs_vs_pred"]["r_squared"] == pytest.approx(0.866924, rel=1e-6)
    assert len(plots["qq"]["theoretical"]) == 8


async def test_analysis_plots_respect_factor_pair_selector(client: AsyncClient) -> None:
    exp_id = await _seed_golden(client)
    resp = await client.post(
        "/analysis",
        json={
            "experiment_id": exp_id,
            "response_name": "DP_50000",
            "model": "linear",
            "factor_x": "par",
            "factor_y": "cond",
        },
    )
    assert resp.status_code == 200
    plots = resp.json()["plots"]
    assert plots["selected_pair"] == ["par", "cond"]
    assert plots["surface"]["factor_x"] == "par"
    assert plots["surface"]["factor_y"] == "cond"


async def test_analysis_quadratic_guard_returns_warning(client: AsyncClient) -> None:
    exp_id = await _seed_golden(client)
    resp = await client.post(
        "/analysis",
        json={
            "experiment_id": exp_id,
            "response_name": "DP_50000",
            "model": "linear_quadratic",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["estimable"] is False
    assert body["stats"] is None
    assert body["warnings"]


async def test_analysis_unknown_experiment_is_404(client: AsyncClient) -> None:
    resp = await client.post(
        "/analysis",
        json={"experiment_id": 999, "response_name": "DP", "model": "linear"},
    )
    assert resp.status_code == 404


async def test_analysis_unknown_response_is_422(client: AsyncClient) -> None:
    exp_id = await _seed_golden(client)
    resp = await client.post(
        "/analysis",
        json={"experiment_id": exp_id, "response_name": "NOPE", "model": "linear"},
    )
    assert resp.status_code == 422

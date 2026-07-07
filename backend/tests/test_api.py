"""End-to-end HTTP test against the ASGI app with an isolated in-memory SQLite.

Verifies the full wiring router -> service -> repo -> DB and the Pydantic
schemas on POST/GET, plus /health.
"""

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from db import get_session
from domain.models import Base
from main import app


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


async def test_health(client: AsyncClient) -> None:
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


async def test_create_and_list_experiments(client: AsyncClient) -> None:
    create = await client.post(
        "/experiments", json={"name": "Fibra", "description": "teste"}
    )
    assert create.status_code == 201
    body = create.json()
    assert body["id"] >= 1
    assert body["name"] == "Fibra"
    assert body["description"] == "teste"
    assert body["created_at"]

    listing = await client.get("/experiments")
    assert listing.status_code == 200
    items = listing.json()
    assert len(items) == 1
    assert items[0]["name"] == "Fibra"


async def test_generate_2k_design(client: AsyncClient) -> None:
    resp = await client.post(
        "/designs/generate",
        json={
            "name": "2^3 exemplo",
            "replicates": 1,
            "factors": [
                {"name": "A", "factor_type": "quantitative", "unit": "%", "low": 0, "high": 1.5},
                {"name": "B", "factor_type": "quantitative", "low": 10, "high": 20},
                {
                    "name": "C",
                    "factor_type": "qualitative",
                    "low_label": "Tucum",
                    "high_label": "Piassava",
                },
            ],
            "responses": [{"name": "MR", "unit": "MPa"}],
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["n_runs"] == 8
    assert len(body["runs"]) == 8
    assert body["experiment_id"] >= 1

    # coding is ±1
    codes = {
        cell["coded"] for run in body["runs"] for cell in run["factors"].values()
    }
    assert codes == {-1, 1}
    # qualitative labels resolved from the persisted map
    labels = {run["factors"]["C"]["label"] for run in body["runs"]}
    assert labels == {"Tucum", "Piassava"}
    # OriginPro-style columns present per run
    first = body["runs"][0]
    assert {"run_order", "std_order", "point_type", "block", "replicate"} <= first.keys()


async def test_generate_rejects_single_factor(client: AsyncClient) -> None:
    resp = await client.post(
        "/designs/generate",
        json={
            "name": "invalido",
            "factors": [{"name": "A", "factor_type": "quantitative", "low": 0, "high": 1}],
        },
    )
    assert resp.status_code == 422


# --- data entry (issue 03) ---------------------------------------------------


async def _generate_2squared(client: AsyncClient) -> dict:
    resp = await client.post(
        "/designs/generate",
        json={
            "name": "entrada",
            "replicates": 1,
            "factors": [
                {"name": "A", "factor_type": "quantitative", "low": 0, "high": 1.5},
                {"name": "B", "factor_type": "quantitative", "low": 10, "high": 20},
            ],
            "responses": [{"name": "MR", "unit": "MPa"}, {"name": "DP", "unit": "mm"}],
        },
    )
    assert resp.status_code == 201
    return resp.json()


async def test_get_runs_returns_matrix_with_ids_and_empty_responses(
    client: AsyncClient,
) -> None:
    design = await _generate_2squared(client)
    exp_id = design["experiment_id"]

    resp = await client.get(f"/experiments/{exp_id}/runs")
    assert resp.status_code == 200
    body = resp.json()
    assert body["n_runs"] == 4
    assert [r["name"] for r in body["responses"]] == ["MR", "DP"]
    assert all(run["id"] is not None for run in body["runs"])
    assert all(run["response_values"] == {} for run in body["runs"])


async def test_save_partial_responses_persists_and_reloads(client: AsyncClient) -> None:
    design = await _generate_2squared(client)
    exp_id = design["experiment_id"]
    runs = (await client.get(f"/experiments/{exp_id}/runs")).json()["runs"]
    first_id = runs[0]["id"]
    second_id = runs[1]["id"]

    save = await client.post(
        f"/experiments/{exp_id}/runs/responses",
        json={
            "values": [
                {"run_id": first_id, "response_name": "MR", "value": "12.5"},
                {"run_id": first_id, "response_name": "DP", "value": "3,25"},
                {"run_id": second_id, "response_name": "MR", "value": ""},
            ]
        },
    )
    assert save.status_code == 200

    # reload: values survive (partial MR/DP on run 1, empty on run 2)
    reloaded = (await client.get(f"/experiments/{exp_id}/runs")).json()["runs"]
    by_id = {r["id"]: r["response_values"] for r in reloaded}
    assert by_id[first_id]["MR"] == 12.5
    assert by_id[first_id]["DP"] == 3.25
    assert by_id[second_id]["MR"] is None


async def test_save_rejects_non_numeric(client: AsyncClient) -> None:
    design = await _generate_2squared(client)
    exp_id = design["experiment_id"]
    run_id = (await client.get(f"/experiments/{exp_id}/runs")).json()["runs"][0]["id"]

    resp = await client.post(
        f"/experiments/{exp_id}/runs/responses",
        json={"values": [{"run_id": run_id, "response_name": "MR", "value": "abc"}]},
    )
    assert resp.status_code == 422


async def test_get_runs_unknown_experiment_is_404(client: AsyncClient) -> None:
    resp = await client.get("/experiments/999/runs")
    assert resp.status_code == 404

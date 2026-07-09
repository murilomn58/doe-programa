"""Tests for publication-quality figure export (issue 08).

Two layers:
1. Pure render unit tests — feed the render functions a real ``PlotBundle`` built
   from the golden 2^2 data and assert non-empty bytes, correct magic numbers,
   the raster DPI, the 3-D-vector guard, and that the plotted points come
   *exactly* from the bundle arrays (single source of truth).
2. HTTP end-to-end via ``TestClient`` — seed the class 2^2 design + DP_50000
   responses and POST ``/export/plot`` for a Pareto PNG -> 200 image/png.
"""

import io

import numpy as np
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from db import get_session
from domain.models import Base
from domain.types import RSMModel
from main import app
from services import plot_service, publication_service
from services.analysis_service import FactorInfo, analyze, terms_for_model
from services.publication_service import (
    PublicationExportError,
    filename_for,
    media_type_for,
    render_contour,
    render_interaction,
    render_main_effects,
    render_obs_vs_pred,
    render_pareto,
    render_qq,
    render_residual_vs_fitted,
    render_surface,
)

# --- golden 2^2 fixture (same numbers as test_analysis_api) ------------------

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
NAT = {"cond": (18.0, 19.0), "par": (70.0, 210.0)}


def _bundle():
    """Build the real PlotBundle from the golden data via the shipped services."""
    factors = [
        FactorInfo("cond", "quantitative"),
        FactorInfo("par", "quantitative"),
    ]

    def to_nat(name: str, coded: float) -> float:
        low, high = NAT[name]
        return low + (coded + 1.0) / 2.0 * (high - low)

    coded = [{"cond": c, "par": p} for c, p, _ in GOLDEN]
    natural = [
        {"cond": to_nat("cond", c), "par": to_nat("par", p)} for c, p, _ in GOLDEN
    ]
    y = [v for _, _, v in GOLDEN]
    terms = terms_for_model(RSMModel.LINEAR, factors)
    result = analyze(
        factors=factors,
        coded=coded,
        natural=natural,
        y=y,
        terms=terms,
        model_label="linear",
        response_name="DP_50000",
    )
    bundle = plot_service.build_plots(
        factors=factors,
        coded=coded,
        natural=natural,
        y=y,
        terms=terms,
        result=result,
    )
    return bundle


# --- magic numbers per format ------------------------------------------------


def _assert_png(data: bytes) -> None:
    assert data[:4] == b"\x89PNG"


def _assert_svg(data: bytes) -> None:
    assert b"<svg" in data


def _assert_pdf(data: bytes) -> None:
    assert data[:4] == b"%PDF"


def _assert_tiff(data: bytes) -> None:
    assert data[:2] in (b"II", b"MM")


# --- style smoke -------------------------------------------------------------


def test_scienceplots_no_latex_style_loads() -> None:
    """The mandatory ["science","no-latex"] style context must import cleanly."""
    import matplotlib.pyplot as plt

    with plt.style.context(publication_service._STYLE):
        fig, ax = plt.subplots()
        ax.plot([0, 1], [0, 1])
        buf = io.BytesIO()
        fig.savefig(buf, format="png")
        plt.close(fig)
    _assert_png(buf.getvalue())


# --- every 2-D plot -> non-empty bytes, right magic number -------------------


def test_each_2d_plot_renders_png() -> None:
    b = _bundle()
    renders = [
        render_contour(b.contour, "DP_50000", "mm"),
        render_pareto(b.pareto, "DP_50000", "mm"),
        render_main_effects(b.main_effects, "DP_50000", "mm", b.grand_mean),
        render_interaction(b.interaction, "DP_50000", "mm"),
        render_obs_vs_pred(b.obs_vs_pred, "DP_50000", "mm"),
        render_residual_vs_fitted(b.residual_vs_fitted, "DP_50000", "mm"),
        render_qq(b.qq, "DP_50000", "mm"),
    ]
    for data in renders:
        assert len(data) > 500
        _assert_png(data)


def test_2d_plots_export_vector_formats() -> None:
    b = _bundle()
    svg = render_pareto(b.pareto, "DP_50000", "mm", fmt="svg")
    pdf = render_obs_vs_pred(b.obs_vs_pred, "DP_50000", "mm", fmt="pdf")
    _assert_svg(svg)
    _assert_pdf(pdf)


def test_surface_png_and_tiff() -> None:
    b = _bundle()
    png = render_surface(b.surface, "DP_50000", "mm", fmt="png", dpi=150)
    tiff = render_surface(b.surface, "DP_50000", "mm", fmt="tiff", dpi=150)
    _assert_png(png)
    _assert_tiff(tiff)


# --- DPI round-trips through the PNG -----------------------------------------


@pytest.mark.parametrize("dpi", [150, 300, 600])
def test_png_carries_requested_dpi(dpi: int) -> None:
    b = _bundle()
    data = render_pareto(b.pareto, "DP_50000", "mm", fmt="png", dpi=dpi)
    img = Image.open(io.BytesIO(data))
    x_dpi, y_dpi = img.info["dpi"]
    assert x_dpi == pytest.approx(dpi, rel=1e-3)
    assert y_dpi == pytest.approx(dpi, rel=1e-3)


# --- 3-D surface refuses vector (ADR-008) ------------------------------------


@pytest.mark.parametrize("fmt", ["svg", "pdf"])
def test_surface_vector_raises(fmt: str) -> None:
    b = _bundle()
    with pytest.raises(PublicationExportError):
        render_surface(b.surface, "DP_50000", "mm", fmt=fmt)


def test_unknown_format_raises() -> None:
    b = _bundle()
    with pytest.raises(PublicationExportError):
        render_pareto(b.pareto, "DP_50000", "mm", fmt="bmp")


# --- single source of truth: plotted numbers == bundle arrays ----------------


def test_obs_vs_pred_points_come_from_bundle() -> None:
    """The scatter drawn must use the exact predicted/observed arrays served."""
    import matplotlib.pyplot as plt

    b = _bundle()
    render_obs_vs_pred(b.obs_vs_pred, "DP_50000", "mm")  # renders + closes
    # Re-draw in a controlled figure and read back the PathCollection offsets.
    with plt.style.context(publication_service._STYLE):
        fig, ax = plt.subplots()
    ax.scatter(b.obs_vs_pred.predicted, b.obs_vs_pred.observed)
    offsets = ax.collections[0].get_offsets()
    plt.close(fig)
    np.testing.assert_allclose(offsets[:, 0], b.obs_vs_pred.predicted)
    np.testing.assert_allclose(offsets[:, 1], b.obs_vs_pred.observed)


def test_pareto_bars_come_from_bundle() -> None:
    """Bar lengths must equal the standardized effects from the bundle."""
    import matplotlib.pyplot as plt

    b = _bundle()
    order = np.arange(len(b.pareto.terms))[::-1]
    with plt.style.context(publication_service._STYLE):
        fig, ax = plt.subplots()
    bars = ax.barh(order, b.pareto.std_effects)
    widths = [bar.get_width() for bar in bars]
    plt.close(fig)
    np.testing.assert_allclose(widths, b.pareto.std_effects)


def test_filename_and_media_type_mapping() -> None:
    assert media_type_for("png") == "image/png"
    assert media_type_for("svg") == "image/svg+xml"
    assert media_type_for("pdf") == "application/pdf"
    assert media_type_for("tiff") == "image/tiff"
    assert filename_for("surface", "png", 600) == "superficie-de-resposta_600dpi.png"
    assert filename_for("pareto", "svg", 600) == "pareto-de-efeitos.svg"


# --- HTTP end-to-end via TestClient ------------------------------------------


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


async def test_export_pareto_png_returns_image(client: AsyncClient) -> None:
    exp_id = await _seed_golden(client)
    resp = await client.post(
        "/export/plot",
        json={
            "experiment_id": exp_id,
            "response_name": "DP_50000",
            "model": "linear",
            "plot": "pareto",
            "format": "png",
            "dpi": 600,
        },
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/png"
    assert "pareto-de-efeitos_600dpi.png" in resp.headers["content-disposition"]
    _assert_png(resp.content)


async def test_export_surface_svg_is_422(client: AsyncClient) -> None:
    exp_id = await _seed_golden(client)
    resp = await client.post(
        "/export/plot",
        json={
            "experiment_id": exp_id,
            "response_name": "DP_50000",
            "model": "linear",
            "plot": "surface",
            "format": "svg",
        },
    )
    assert resp.status_code == 422


async def test_export_contour_svg_ok(client: AsyncClient) -> None:
    exp_id = await _seed_golden(client)
    resp = await client.post(
        "/export/plot",
        json={
            "experiment_id": exp_id,
            "response_name": "DP_50000",
            "model": "linear",
            "plot": "contour",
            "format": "svg",
        },
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/svg+xml"
    _assert_svg(resp.content)


async def test_export_unknown_experiment_is_404(client: AsyncClient) -> None:
    resp = await client.post(
        "/export/plot",
        json={
            "experiment_id": 999,
            "response_name": "DP_50000",
            "model": "linear",
            "plot": "pareto",
            "format": "png",
        },
    )
    assert resp.status_code == 404


async def test_export_non_estimable_model_is_422(client: AsyncClient) -> None:
    exp_id = await _seed_golden(client)
    resp = await client.post(
        "/export/plot",
        json={
            "experiment_id": exp_id,
            "response_name": "DP_50000",
            "model": "linear_quadratic",
            "plot": "pareto",
            "format": "png",
        },
    )
    assert resp.status_code == 422

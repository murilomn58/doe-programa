"""Publication-quality figure export (issue 08, ADR-008 "render duplo").

Server-side rendering of the *same* ``PlotBundle`` arrays the browser draws with
Plotly, but through matplotlib + SciencePlots so the output is journal-ready:
white background, serif font, ``viridis`` colormap, thin frame, inward ticks,
axis labels carrying the response unit, R^2 annotated where it fits.

One source of truth: the render functions consume the frozen dataclasses from
``domain.plots`` (filled by ``plot_service.build_plots``) and never recompute a
statistic — they only *draw* the numbers already computed on the backend.

Rasters (PNG/TIFF) are exported at 600 DPI by default. 2-D charts also export as
vector (SVG/PDF). A 3-D response surface (mplot3d) has no clean vector form, so
requesting SVG/PDF for it raises :class:`PublicationExportError` (ADR-008),
which the router translates to HTTP 422.
"""

from __future__ import annotations

import io
from typing import Protocol

import matplotlib

matplotlib.use("Agg")  # headless: no GUI backend on the server

import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import scienceplots  # noqa: E402,F401  (registers the "science" style)
from matplotlib.figure import Figure  # noqa: E402

from domain.errors import ExperimentNotFoundError, InsufficientDataError  # noqa: E402
from domain.models import Experiment, Factor, Response, Run  # noqa: E402
from domain.plots import (  # noqa: E402
    InteractionData,
    MainEffectData,
    ObsVsPredData,
    ParetoData,
    PlotBundle,
    QQData,
    ScatterData,
    SurfaceData,
)
from domain.types import RSMModel  # noqa: E402
from services.analysis_service import AnalysisService  # noqa: E402

# Publication style: journal look, but "no-latex" is mandatory on Windows where
# no LaTeX toolchain is installed ("science" alone shells out to latex).
_STYLE = ["science", "no-latex"]
VIRIDIS = "viridis"
LINE_COLOR = "#0b3d91"  # deep blue main line, viridis-adjacent
POINT_COLOR = "#440154"  # viridis low end
DEFAULT_DPI = 600

# 2-D charts that support vector export; the 3-D surface does not.
RASTER_FORMATS = {"png", "tiff"}
VECTOR_FORMATS = {"svg", "pdf"}
ALL_FORMATS = RASTER_FORMATS | VECTOR_FORMATS

PLOT_KINDS = {
    "surface",
    "contour",
    "pareto",
    "main_effects",
    "interaction",
    "obs_vs_pred",
    "residual_vs_fitted",
    "qq",
}


class PublicationExportError(ValueError):
    """A figure cannot be exported as requested.

    Examples: a 3-D surface asked for in a vector format, a plot the fitted
    model does not produce (e.g. no surface without two quantitative factors),
    or an unsupported plot/format token. Routed to HTTP 422.
    """


# --- styling helpers ---------------------------------------------------------


def _axis_label(name: str, unit: str | None) -> str:
    return f"{name} ({unit})" if unit else name


def _style_2d(ax) -> None:
    """Thin frame, inward ticks — the shared publication look for 2-D axes."""
    ax.tick_params(direction="in", top=True, right=True)
    for spine in ax.spines.values():
        spine.set_linewidth(0.6)


def _finish(fig: Figure, fmt: str, dpi: int) -> bytes:
    """Render ``fig`` to bytes in ``fmt`` on a white background, then close it."""
    buf = io.BytesIO()
    fig.savefig(
        buf,
        format=fmt,
        dpi=dpi,
        bbox_inches="tight",
        facecolor="white",
        edgecolor="white",
    )
    plt.close(fig)
    return buf.getvalue()


def _new_fig(figsize=(4.0, 3.0)):
    with plt.style.context(_STYLE):
        fig, ax = plt.subplots(figsize=figsize)
    fig.set_facecolor("white")
    ax.set_facecolor("white")
    return fig, ax


def _validate_format(fmt: str) -> None:
    if fmt not in ALL_FORMATS:
        raise PublicationExportError(
            f"Formato '{fmt}' não suportado. Use png, tiff, svg ou pdf."
        )


# --- 3-D response surface (raster only) --------------------------------------


def render_surface(
    surface: SurfaceData,
    response_name: str,
    response_unit: str | None,
    fmt: str = "png",
    dpi: int = DEFAULT_DPI,
) -> bytes:
    """3-D response surface via mplot3d. Raster (PNG/TIFF) only — see ADR-008."""
    _validate_format(fmt)
    if fmt not in RASTER_FORMATS:
        raise PublicationExportError(
            "Superfície 3D só exporta em PNG/TIFF (raster). O vetor 3D não "
            "fica limpo (ADR-008). Para vetor, use o gráfico de contorno."
        )

    x = np.asarray(surface.x, dtype=float)
    y = np.asarray(surface.y, dtype=float)
    z = np.asarray(surface.z, dtype=float)
    xx, yy = np.meshgrid(x, y)

    with plt.style.context(_STYLE):
        fig = plt.figure(figsize=(5.0, 4.0))
        ax = fig.add_subplot(111, projection="3d")
    fig.set_facecolor("white")
    ax.set_facecolor("white")

    surf = ax.plot_surface(
        xx, yy, z, cmap=VIRIDIS, linewidth=0.0, antialiased=True, rstride=1, cstride=1
    )
    fig.colorbar(surf, ax=ax, shrink=0.6, aspect=12, pad=0.1)
    ax.set_xlabel(surface.factor_x)
    ax.set_ylabel(surface.factor_y)
    ax.set_zlabel(_axis_label(response_name, response_unit))
    return _finish(fig, fmt, dpi)


# --- 2-D contour -------------------------------------------------------------


def render_contour(
    contour: SurfaceData,
    response_name: str,
    response_unit: str | None,
    fmt: str = "png",
    dpi: int = DEFAULT_DPI,
) -> bytes:
    """Filled contour of the same surface grid, with the observed runs overlaid."""
    _validate_format(fmt)
    x = np.asarray(contour.x, dtype=float)
    y = np.asarray(contour.y, dtype=float)
    z = np.asarray(contour.z, dtype=float)
    xx, yy = np.meshgrid(x, y)

    fig, ax = _new_fig(figsize=(4.2, 3.2))
    cf = ax.contourf(xx, yy, z, levels=14, cmap=VIRIDIS)
    ax.contour(xx, yy, z, levels=14, colors="white", linewidths=0.3, alpha=0.5)
    if contour.points_x and contour.points_y:
        ax.scatter(
            contour.points_x,
            contour.points_y,
            c="white",
            edgecolors="black",
            s=18,
            linewidths=0.6,
            zorder=5,
        )
    cbar = fig.colorbar(cf, ax=ax)
    cbar.set_label(_axis_label(response_name, response_unit))
    ax.set_xlabel(contour.factor_x)
    ax.set_ylabel(contour.factor_y)
    _style_2d(ax)
    return _finish(fig, fmt, dpi)


# --- Pareto of standardized effects ------------------------------------------


def render_pareto(
    pareto: ParetoData,
    response_name: str,
    response_unit: str | None,
    fmt: str = "png",
    dpi: int = DEFAULT_DPI,
) -> bytes:
    """Horizontal bars of |t| (largest at top) with the p=alpha reference line."""
    _validate_format(fmt)
    terms = list(pareto.terms)
    effects = np.asarray(pareto.std_effects, dtype=float)
    order = np.arange(len(terms))[::-1]  # largest at the top

    fig, ax = _new_fig(figsize=(4.2, 3.0))
    ax.barh(order, effects, color=plt.get_cmap(VIRIDIS)(0.55), edgecolor="black",
            linewidth=0.4)
    ax.set_yticks(order)
    ax.set_yticklabels(terms)
    ax.axvline(
        pareto.sig_line,
        color="crimson",
        linestyle="--",
        linewidth=0.8,
        label=f"p = {pareto.alpha:g}",
    )
    ax.set_xlabel("Efeito padronizado |t|")
    ax.legend(frameon=False, fontsize=7, loc="lower right")
    _style_2d(ax)
    return _finish(fig, fmt, dpi)


# --- main effects ------------------------------------------------------------


def render_main_effects(
    main_effects: list[MainEffectData],
    response_name: str,
    response_unit: str | None,
    grand_mean: float,
    fmt: str = "png",
    dpi: int = DEFAULT_DPI,
) -> bytes:
    """One small panel per factor: mean response at each coded level (-1/+1)."""
    _validate_format(fmt)
    if not main_effects:
        raise PublicationExportError("Sem efeitos principais para exportar.")

    n = len(main_effects)
    with plt.style.context(_STYLE):
        fig, axes = plt.subplots(1, n, figsize=(2.2 * n, 2.8), sharey=True)
    fig.set_facecolor("white")
    axes = np.atleast_1d(axes)
    for ax, me in zip(axes, main_effects, strict=False):
        ax.set_facecolor("white")
        ax.plot(me.levels, me.means, marker="o", color=LINE_COLOR, linewidth=1.0)
        ax.axhline(grand_mean, color="grey", linestyle=":", linewidth=0.7)
        ax.set_xticks(me.levels)
        ax.set_xticklabels(me.level_labels)
        ax.set_xlabel(me.factor)
        _style_2d(ax)
    axes[0].set_ylabel(_axis_label(response_name, response_unit))
    fig.tight_layout()
    return _finish(fig, fmt, dpi)


# --- interaction -------------------------------------------------------------


def render_interaction(
    interaction: InteractionData,
    response_name: str,
    response_unit: str | None,
    fmt: str = "png",
    dpi: int = DEFAULT_DPI,
) -> bytes:
    """Marginal means of ``factor_x`` with one line per ``factor_group`` level."""
    _validate_format(fmt)
    fig, ax = _new_fig(figsize=(4.0, 3.0))
    cmap = plt.get_cmap(VIRIDIS)
    n_lines = max(len(interaction.lines), 1)
    for i, line in enumerate(interaction.lines):
        color = cmap(0.15 + 0.7 * (i / max(n_lines - 1, 1)))
        ax.plot(
            line.x,
            line.y,
            marker="o",
            color=color,
            linewidth=1.0,
            label=f"{interaction.factor_group} = {line.level_label}",
        )
    ax.set_xticks(interaction.x_levels)
    ax.set_xticklabels(interaction.x_labels)
    ax.set_xlabel(interaction.factor_x)
    ax.set_ylabel(_axis_label(response_name, response_unit))
    ax.legend(frameon=False, fontsize=7)
    _style_2d(ax)
    return _finish(fig, fmt, dpi)


# --- observed vs predicted ---------------------------------------------------


def render_obs_vs_pred(
    obs_vs_pred: ObsVsPredData,
    response_name: str,
    response_unit: str | None,
    fmt: str = "png",
    dpi: int = DEFAULT_DPI,
) -> bytes:
    """Observed vs predicted scatter with the 45-degree reference and R^2."""
    _validate_format(fmt)
    fig, ax = _new_fig(figsize=(3.4, 3.2))
    ax.plot(
        [obs_vs_pred.line_min, obs_vs_pred.line_max],
        [obs_vs_pred.line_min, obs_vs_pred.line_max],
        color="grey",
        linestyle="--",
        linewidth=0.7,
    )
    ax.scatter(
        obs_vs_pred.predicted,
        obs_vs_pred.observed,
        c=POINT_COLOR,
        s=18,
        edgecolors="black",
        linewidths=0.4,
    )
    unit = f" ({response_unit})" if response_unit else ""
    ax.set_xlabel(f"Predito{unit}")
    ax.set_ylabel(f"Observado{unit}")
    if np.isfinite(obs_vs_pred.r_squared):
        ax.annotate(
            f"$R^2 = {obs_vs_pred.r_squared:.4f}$",
            xy=(0.05, 0.92),
            xycoords="axes fraction",
            fontsize=8,
        )
    _style_2d(ax)
    return _finish(fig, fmt, dpi)


# --- residuals vs fitted -----------------------------------------------------


def render_residual_vs_fitted(
    scatter: ScatterData,
    response_name: str,
    response_unit: str | None,
    fmt: str = "png",
    dpi: int = DEFAULT_DPI,
) -> bytes:
    """Residual vs fitted scatter with a zero reference line."""
    _validate_format(fmt)
    fig, ax = _new_fig(figsize=(3.6, 3.0))
    ax.axhline(0.0, color="grey", linestyle="--", linewidth=0.7)
    ax.scatter(
        scatter.x,
        scatter.y,
        c=POINT_COLOR,
        s=18,
        edgecolors="black",
        linewidths=0.4,
    )
    unit = f" ({response_unit})" if response_unit else ""
    ax.set_xlabel(f"Valores ajustados{unit}")
    ax.set_ylabel(f"Resíduos{unit}")
    _style_2d(ax)
    return _finish(fig, fmt, dpi)


# --- normal Q-Q --------------------------------------------------------------


def render_qq(
    qq: QQData,
    response_name: str,
    response_unit: str | None,
    fmt: str = "png",
    dpi: int = DEFAULT_DPI,
) -> bytes:
    """Normal Q-Q plot of the residuals with the fitted reference line."""
    _validate_format(fmt)
    fig, ax = _new_fig(figsize=(3.4, 3.2))
    theo = np.asarray(qq.theoretical, dtype=float)
    ax.scatter(
        theo,
        qq.sample,
        c=POINT_COLOR,
        s=18,
        edgecolors="black",
        linewidths=0.4,
    )
    if theo.size:
        line_x = np.array([theo.min(), theo.max()])
        ax.plot(
            line_x,
            qq.line_intercept + qq.line_slope * line_x,
            color="grey",
            linestyle="--",
            linewidth=0.7,
        )
    ax.set_xlabel("Quantis teoricos")
    ax.set_ylabel("Quantis amostrais")
    _style_2d(ax)
    return _finish(fig, fmt, dpi)


# --- media type / filename mapping -------------------------------------------

_MEDIA_TYPE = {
    "png": "image/png",
    "tiff": "image/tiff",
    "svg": "image/svg+xml",
    "pdf": "application/pdf",
}

_PLOT_SLUG = {
    "surface": "superficie-de-resposta",
    "contour": "grafico-de-contorno",
    "pareto": "pareto-de-efeitos",
    "main_effects": "efeitos-principais",
    "interaction": "grafico-de-interacao",
    "obs_vs_pred": "observado-vs-predito",
    "residual_vs_fitted": "residuos-vs-ajustados",
    "qq": "grafico-qq-normal",
}


def media_type_for(fmt: str) -> str:
    _validate_format(fmt)
    return _MEDIA_TYPE[fmt]


def filename_for(plot: str, fmt: str, dpi: int) -> str:
    slug = _PLOT_SLUG.get(plot, plot)
    if fmt in RASTER_FORMATS:
        return f"{slug}_{dpi}dpi.{fmt}"
    return f"{slug}.{fmt}"


# --- repository port + service -----------------------------------------------


class ExportRepository(Protocol):
    """Read-only port (same shape as the run/analysis repo)."""

    async def get_experiment(self, experiment_id: int) -> Experiment | None: ...

    async def get_factors(self, experiment_id: int) -> list[Factor]: ...

    async def get_responses(self, experiment_id: int) -> list[Response]: ...

    async def get_runs(self, experiment_id: int) -> list[Run]: ...


class PublicationService:
    """Compose the analysis' ``PlotBundle`` with the matplotlib renderers.

    Reuses ``AnalysisService`` to obtain the exact same ``AnalysisResultData`` +
    ``PlotBundle`` the ``/analysis`` endpoint serves (single source of truth),
    then renders the requested part to publication-quality bytes.
    """

    def __init__(self, repo: ExportRepository) -> None:
        self._repo = repo
        self._analysis = AnalysisService(repo)

    async def export_plot(
        self,
        experiment_id: int,
        response_name: str,
        model: RSMModel,
        plot: str,
        fmt: str,
        dpi: int = DEFAULT_DPI,
        factor_x: str | None = None,
        factor_y: str | None = None,
    ) -> tuple[bytes, str, str]:
        """Return ``(content, media_type, filename)`` for the requested figure.

        Raises ``ExperimentNotFoundError`` (404) and ``InsufficientDataError`` /
        ``PublicationExportError`` (422) exactly like the analysis flow.
        """
        if plot not in PLOT_KINDS:
            raise PublicationExportError(
                f"Gráfico '{plot}' desconhecido. Opções: {sorted(PLOT_KINDS)}."
            )
        _validate_format(fmt)

        result = await self._analysis.analyze(
            experiment_id,
            response_name,
            model,
            factor_x=factor_x,
            factor_y=factor_y,
        )
        if not result.estimable or result.plots is None:
            reason = result.warnings[0] if result.warnings else (
                "Modelo saturado ou não estimável: sem gráficos para exportar."
            )
            raise PublicationExportError(reason)

        unit = await self._response_unit(experiment_id, response_name)
        content = self._render(plot, result.plots, response_name, unit, fmt, dpi)
        return content, media_type_for(fmt), filename_for(plot, fmt, dpi)

    async def _response_unit(
        self, experiment_id: int, response_name: str
    ) -> str | None:
        for resp in await self._repo.get_responses(experiment_id):
            if resp.name == response_name:
                return resp.unit
        return None

    def _render(
        self,
        plot: str,
        bundle: PlotBundle,
        response_name: str,
        unit: str | None,
        fmt: str,
        dpi: int,
    ) -> bytes:
        if plot == "surface":
            _require(bundle.surface, "superfície de resposta")
            return render_surface(bundle.surface, response_name, unit, fmt, dpi)
        if plot == "contour":
            _require(bundle.contour, "gráfico de contorno")
            return render_contour(bundle.contour, response_name, unit, fmt, dpi)
        if plot == "pareto":
            _require(bundle.pareto, "Pareto de efeitos")
            return render_pareto(bundle.pareto, response_name, unit, fmt, dpi)
        if plot == "main_effects":
            return render_main_effects(
                bundle.main_effects, response_name, unit, bundle.grand_mean, fmt, dpi
            )
        if plot == "interaction":
            _require(bundle.interaction, "gráfico de interação")
            return render_interaction(bundle.interaction, response_name, unit, fmt, dpi)
        if plot == "obs_vs_pred":
            _require(bundle.obs_vs_pred, "observado vs predito")
            return render_obs_vs_pred(bundle.obs_vs_pred, response_name, unit, fmt, dpi)
        if plot == "residual_vs_fitted":
            _require(bundle.residual_vs_fitted, "resíduos vs ajustados")
            return render_residual_vs_fitted(
                bundle.residual_vs_fitted, response_name, unit, fmt, dpi
            )
        # plot == "qq"
        _require(bundle.qq, "gráfico Q-Q")
        return render_qq(bundle.qq, response_name, unit, fmt, dpi)


def _require(part: object | None, label: str) -> None:
    if part is None:
        raise PublicationExportError(
            f"O modelo ajustado não produz {label} (ex.: sem dois fatores "
            "quantitativos para a superfície)."
        )


__all__ = [
    "PublicationService",
    "PublicationExportError",
    "ExportRepository",
    "render_surface",
    "render_contour",
    "render_pareto",
    "render_main_effects",
    "render_interaction",
    "render_obs_vs_pred",
    "render_residual_vs_fitted",
    "render_qq",
    "media_type_for",
    "filename_for",
    "DEFAULT_DPI",
]


# Referenced only to satisfy linters that ``ExperimentNotFoundError`` /
# ``InsufficientDataError`` propagate from the analysis service (documented in
# ``export_plot``'s docstring); imported so tests can assert on them.
_DOMAIN_ERRORS = (ExperimentNotFoundError, InsufficientDataError)

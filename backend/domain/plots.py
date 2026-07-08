"""Framework-free plot data (issue 05).

The ``PlotService`` fills these plain dataclasses with the arrays the frontend
needs to *draw* the interactive charts — surface/contour grids, Pareto bars,
observed-vs-predicted pairs, residual/Q-Q scatters, main-effects and interaction
lines. Every number is computed on the backend (one source of truth); the
frontend only maps these arrays onto Plotly traces. No fastapi, no plotly here.
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class SurfaceData:
    """A response-surface / contour grid over two factors.

    ``x``/``y`` are 1-D axis positions in *natural* units (length N); ``z`` is
    the N x N predicted response (``z[j][i]`` at ``x[i]``, ``y[j]``), with every
    other factor held at the coded center. ``points_x``/``points_y`` are the
    observed runs' natural values on the plotted pair (contour overlay).
    """

    factor_x: str
    factor_y: str
    x: list[float]
    y: list[float]
    z: list[list[float]]
    points_x: list[float] = field(default_factory=list)
    points_y: list[float] = field(default_factory=list)


@dataclass(frozen=True)
class ParetoData:
    """Standardized effects (|t|) sorted descending, with the p=.05 line."""

    terms: list[str]
    std_effects: list[float]
    sig_line: float
    alpha: float


@dataclass(frozen=True)
class MainEffectData:
    """Observed mean response at each coded level of one factor."""

    factor: str
    level_labels: list[str]
    levels: list[float]
    means: list[float]


@dataclass(frozen=True)
class InteractionLine:
    """One grouping-level line of an interaction plot, with 95% CI bands."""

    level_label: str
    x: list[float]
    y: list[float]
    ci_low: list[float]
    ci_high: list[float]


@dataclass(frozen=True)
class InteractionData:
    """Marginal means of ``factor_x`` with one line per ``factor_group`` level."""

    factor_x: str
    factor_group: str
    x_levels: list[float]
    x_labels: list[str]
    lines: list[InteractionLine]


@dataclass(frozen=True)
class ObsVsPredData:
    """Observed vs predicted scatter + a 45-degree reference line and R^2."""

    observed: list[float]
    predicted: list[float]
    line_min: float
    line_max: float
    r_squared: float


@dataclass(frozen=True)
class ScatterData:
    """Generic (x, y) scatter — used for residuals vs fitted."""

    x: list[float]
    y: list[float]


@dataclass(frozen=True)
class QQData:
    """Normal Q-Q plot: ordered sample quantiles vs theoretical, plus its line."""

    theoretical: list[float]
    sample: list[float]
    line_slope: float
    line_intercept: float


@dataclass(frozen=True)
class PlotBundle:
    """Everything the analysis screen needs to render the base charts."""

    factor_pairs: list[list[str]]
    selected_pair: list[str] | None
    grand_mean: float
    surface: SurfaceData | None = None
    contour: SurfaceData | None = None
    pareto: ParetoData | None = None
    main_effects: list[MainEffectData] = field(default_factory=list)
    interaction: InteractionData | None = None
    obs_vs_pred: ObsVsPredData | None = None
    residual_vs_fitted: ScatterData | None = None
    qq: QQData | None = None

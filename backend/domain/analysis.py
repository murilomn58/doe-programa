"""Framework-free DTOs for the analysis engine (issue 04).

These plain dataclasses are produced by the pure ``analyze`` core in
``services.analysis_service`` and mapped to Pydantic read-schemas by the
service. Keeping them framework-free lets the golden test drive the core
directly, with no HTTP or database in the loop.
"""

from dataclasses import dataclass, field

from domain.plots import PlotBundle


@dataclass(frozen=True)
class TermInfo:
    """One model term: its display label and its patsy sub-expression.

    ``kind`` is one of ``main`` / ``interaction`` / ``quadratic``. ``factors``
    lists the display factor names involved (a quadratic repeats its factor).
    """

    label: str
    patsy: str
    kind: str
    factors: list[str]


@dataclass(frozen=True)
class AnovaRow:
    """One ANOVA line (a model term, or a pooled Pure Error / Lack-of-Fit)."""

    source: str
    ss: float
    df: int
    ms: float
    f: float | None = None
    p: float | None = None


@dataclass(frozen=True)
class EffectRow:
    """One factorial effect (2x its coded coefficient) with inference."""

    term: str
    effect: float
    coef_coded: float
    std_err: float | None = None
    t: float | None = None
    p: float | None = None
    ci_low: float | None = None
    ci_high: float | None = None
    # Saturated designs only: Lenth pseudo t = effect / PSE.
    pseudo_t: float | None = None
    significant: bool | None = None


@dataclass(frozen=True)
class CoefRow:
    """One regression coefficient in coded and natural units, with VIF."""

    term: str
    coef_coded: float
    coef_natural: float | None = None
    std_err: float | None = None
    t: float | None = None
    p: float | None = None
    ci_low: float | None = None
    ci_high: float | None = None
    vif: float | None = None


@dataclass(frozen=True)
class StatsPanel:
    """Goodness-of-fit summary."""

    n_obs: int
    df_resid: int
    r_squared: float
    adj_r_squared: float
    rmse: float
    sse: float
    total_ss: float
    press: float | None = None
    predicted_r_squared: float | None = None


@dataclass(frozen=True)
class LenthResult:
    """Lenth PSE margins for a saturated design (no error df)."""

    pse: float
    me: float
    sme: float
    alpha: float


@dataclass
class AnalysisResultData:
    """The full analysis for one response under one model."""

    response_name: str
    model: str
    terms: list[TermInfo]
    estimable: bool = True
    saturated: bool = False
    warnings: list[str] = field(default_factory=list)
    # Qualitative sign maps: factor name -> {"-1": low_label, "+1": high_label}.
    sign_maps: dict[str, dict[str, str]] = field(default_factory=dict)
    anova: list[AnovaRow] = field(default_factory=list)
    pure_error: AnovaRow | None = None
    lack_of_fit: AnovaRow | None = None
    # Teste de curvatura via pontos centrais (aula Cap.4 p4); None quando nao se aplica.
    curvature: AnovaRow | None = None
    total: AnovaRow | None = None
    effects: list[EffectRow] = field(default_factory=list)
    coefficients: list[CoefRow] = field(default_factory=list)
    stats: StatsPanel | None = None
    lenth: LenthResult | None = None
    r_squared: float | None = None
    adj_r_squared: float | None = None
    ms_pure_error: float | None = None
    # Ready-to-draw Plotly arrays (issue 05). Populated by the service (not the
    # pure ``analyze`` core) for estimable, non-saturated fits.
    plots: PlotBundle | None = None

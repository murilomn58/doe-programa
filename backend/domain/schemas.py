"""Pydantic request/response schemas (the HTTP contract)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from domain.types import CCDVariant, DesignType, FactorType, RSMModel


class ExperimentCreate(BaseModel):
    """POST /experiments body."""

    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class ExperimentRead(BaseModel):
    """Experiment as returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    created_at: datetime


# --- Design generation (issue 02) --------------------------------------------


class FactorSpec(BaseModel):
    """A factor as described by the user in the setup wizard."""

    name: str = Field(min_length=1, max_length=255)
    factor_type: FactorType
    unit: str | None = Field(default=None, max_length=50)
    # quantitative: numeric endpoints
    low: float | None = None
    high: float | None = None
    # qualitative: category labels
    low_label: str | None = Field(default=None, max_length=255)
    high_label: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def _check_levels(self) -> "FactorSpec":
        if self.factor_type is FactorType.QUANTITATIVE:
            if self.low is None or self.high is None:
                raise ValueError(
                    f"Fator quantitativo '{self.name}' precisa de valores baixo e alto."
                )
            if self.low == self.high:
                raise ValueError(
                    f"Fator quantitativo '{self.name}': baixo e alto não podem ser iguais."
                )
        else:
            if not self.low_label or not self.high_label:
                raise ValueError(
                    f"Fator qualitativo '{self.name}' precisa de rótulos baixo e alto."
                )
        return self


class ResponseSpec(BaseModel):
    """A response (output) column to be measured."""

    name: str = Field(min_length=1, max_length=255)
    unit: str | None = Field(default=None, max_length=50)


class FractionalConfig(BaseModel):
    """Configuration for a fractional factorial 2^(k-p) design.

    Exactly ONE of ``generators`` (pyDOE3 ``fracfact`` string, e.g. "a b ab")
    or ``resolution`` (pyDOE3 ``fracfact_by_res``) must be provided.
    """

    generators: str | None = None
    resolution: int | None = Field(default=None, ge=3, le=6)

    @model_validator(mode="after")
    def _exactly_one(self) -> "FractionalConfig":
        if (self.generators is None) == (self.resolution is None):
            raise ValueError(
                "Planejamento fracionado: informe exatamente um entre "
                "'generators' e 'resolution'."
            )
        return self


class CCDConfig(BaseModel):
    """Configuration for a Central Composite Design."""

    variant: CCDVariant = CCDVariant.ROTATABLE
    center_factorial: int = Field(default=4, ge=0, le=20)  # centers in cube block
    center_axial: int = Field(default=4, ge=0, le=20)  # centers in star block


class DesignGenerateRequest(BaseModel):
    """POST /designs/generate body."""

    name: str | None = Field(default=None, max_length=255)
    experiment_id: int | None = None
    design_type: DesignType = DesignType.FULL_FACTORIAL_2K
    replicates: int = Field(default=1, ge=1, le=20)
    factors: list[FactorSpec] = Field(min_length=1)
    responses: list[ResponseSpec] = Field(default_factory=list)
    seed: int | None = None  # optional: deterministic run-order randomization
    # family-specific knobs (ignored by families that don't use them)
    fractional: FractionalConfig | None = None
    ccd: CCDConfig | None = None
    bbd_center: int = Field(default=3, ge=0, le=20)  # BBD center points
    center_points: int = Field(default=0, ge=0, le=20)  # 2^k / fractional


class LevelRead(BaseModel):
    coded_value: int
    natural_value: float | None = None
    label: str | None = None


class FactorRead(BaseModel):
    id: int | None = None
    name: str
    factor_type: FactorType
    unit: str | None = None
    position: int
    levels: list[LevelRead]


class ResponseRead(BaseModel):
    id: int | None = None
    name: str
    unit: str | None = None
    position: int


class RunCellRead(BaseModel):
    # int | float (smart union): 2^k/fractional corners stay JSON ints exactly
    # as before (golden bytes intact); CCD axials/centers carry floats.
    coded: int | float
    natural: float | None = None
    label: str | None = None


class RunRead(BaseModel):
    id: int | None = None
    run_order: int
    std_order: int
    point_type: int
    block: int
    replicate: int
    factors: dict[str, RunCellRead]
    # Measured response values keyed by response name; empty until entered.
    response_values: dict[str, float | None] = Field(default_factory=dict)


class DesignRead(BaseModel):
    """The generated matrix returned to the frontend RunsTable (read-only)."""

    experiment_id: int
    design_type: DesignType
    n_runs: int
    factors: list[FactorRead]
    responses: list[ResponseRead]
    runs: list[RunRead]
    # fractional 2^(k-p) only; None for every other family
    resolution: int | None = None
    aliasing: list[str] | None = None


# --- data entry (issue 03) ---------------------------------------------------


class RunsRead(BaseModel):
    """The persisted matrix + response values for the editable RunsGrid."""

    experiment_id: int
    n_runs: int
    factors: list[FactorRead]
    responses: list[ResponseRead]
    runs: list[RunRead]


class ResponseValueUpsert(BaseModel):
    """One cell of the response grid to persist.

    ``value`` is the raw cell text (spreadsheet-style): the service parses it,
    accepting ``.``/``,`` decimals and treating empty/whitespace as "cleared"
    (stored as null so partial entry survives).
    """

    run_id: int
    response_name: str = Field(min_length=1, max_length=255)
    value: str | None = None


class ResponsesUpsertRequest(BaseModel):
    """POST /experiments/{id}/runs/responses body — a bulk upsert."""

    values: list[ResponseValueUpsert] = Field(default_factory=list)


# --- analysis (issue 04) -----------------------------------------------------


class AnalysisRequest(BaseModel):
    """POST /analysis body — one response, one RSM model.

    ``factor_x``/``factor_y`` pick which pair of quantitative factors the
    surface/contour/interaction charts plot (defaults to the first pair).
    """

    experiment_id: int
    response_name: str = Field(min_length=1, max_length=255)
    model: RSMModel = RSMModel.LINEAR
    factor_x: str | None = None
    factor_y: str | None = None


class TermRead(BaseModel):
    label: str
    kind: str


class AnovaRowRead(BaseModel):
    source: str
    ss: float
    df: int
    ms: float | None = None
    f: float | None = None
    p: float | None = None


class EffectRowRead(BaseModel):
    term: str
    effect: float
    coef_coded: float
    std_err: float | None = None
    t: float | None = None
    p: float | None = None
    ci_low: float | None = None
    ci_high: float | None = None
    pseudo_t: float | None = None
    significant: bool | None = None


class CoefRowRead(BaseModel):
    term: str
    coef_coded: float
    coef_natural: float | None = None
    std_err: float | None = None
    t: float | None = None
    p: float | None = None
    ci_low: float | None = None
    ci_high: float | None = None
    vif: float | None = None


class StatsPanelRead(BaseModel):
    n_obs: int
    df_resid: int
    r_squared: float
    adj_r_squared: float
    rmse: float
    sse: float
    total_ss: float
    press: float | None = None
    predicted_r_squared: float | None = None


class LenthRead(BaseModel):
    pse: float
    me: float
    sme: float
    alpha: float


# --- plots (issue 05) --------------------------------------------------------


class SurfaceRead(BaseModel):
    factor_x: str
    factor_y: str
    x: list[float]
    y: list[float]
    z: list[list[float | None]]
    # observed experimental points (natural units) for the contour overlay
    points_x: list[float] = Field(default_factory=list)
    points_y: list[float] = Field(default_factory=list)


class ParetoRead(BaseModel):
    terms: list[str]
    std_effects: list[float]
    sig_line: float
    alpha: float


class MainEffectRead(BaseModel):
    factor: str
    level_labels: list[str]
    levels: list[float]
    means: list[float | None]


class InteractionLineRead(BaseModel):
    level_label: str
    x: list[float]
    y: list[float | None]
    ci_low: list[float | None]
    ci_high: list[float | None]


class InteractionRead(BaseModel):
    factor_x: str
    factor_group: str
    x_levels: list[float]
    x_labels: list[str]
    lines: list[InteractionLineRead]


class ObsVsPredRead(BaseModel):
    observed: list[float]
    predicted: list[float]
    line_min: float
    line_max: float
    r_squared: float | None = None


class ScatterRead(BaseModel):
    x: list[float]
    y: list[float]


class QQRead(BaseModel):
    theoretical: list[float]
    sample: list[float]
    line_slope: float
    line_intercept: float


class PlotsRead(BaseModel):
    factor_pairs: list[list[str]]
    selected_pair: list[str] | None = None
    grand_mean: float
    surface: SurfaceRead | None = None
    contour: SurfaceRead | None = None
    pareto: ParetoRead | None = None
    main_effects: list[MainEffectRead] = Field(default_factory=list)
    interaction: InteractionRead | None = None
    obs_vs_pred: ObsVsPredRead | None = None
    residual_vs_fitted: ScatterRead | None = None
    qq: QQRead | None = None


class AnalysisResultRead(BaseModel):
    """The full analysis returned by POST /analysis."""

    response_name: str
    model: RSMModel
    estimable: bool
    saturated: bool
    warnings: list[str]
    sign_maps: dict[str, dict[str, str]]
    terms: list[TermRead]
    anova: list[AnovaRowRead]
    pure_error: AnovaRowRead | None = None
    lack_of_fit: AnovaRowRead | None = None
    total: AnovaRowRead | None = None
    effects: list[EffectRowRead]
    coefficients: list[CoefRowRead]
    stats: StatsPanelRead | None = None
    lenth: LenthRead | None = None
    r_squared: float | None = None
    adj_r_squared: float | None = None
    ms_pure_error: float | None = None
    plots: PlotsRead | None = None

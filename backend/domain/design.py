"""Plain-data DTOs for design generation.

Framework-free dataclasses shared by the ``DesignService`` (which produces
them) and the ``DesignRepository`` (which persists them). Kept separate from
the SQLAlchemy models and the Pydantic schemas so the generation core can be
unit-tested without a database or HTTP layer.
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class LevelData:
    """One coded level of a factor, with its natural value or label."""

    coded: int  # -1 or +1
    natural: float | None = None  # quantitative
    label: str | None = None  # qualitative


@dataclass(frozen=True)
class FactorData:
    """A factor plus its persisted coded<->natural/label map (its levels)."""

    name: str
    factor_type: str
    unit: str | None
    position: int
    levels: list[LevelData]


@dataclass(frozen=True)
class ResponseData:
    """A measured response column (values entered in a later slice)."""

    name: str
    unit: str | None
    position: int


@dataclass(frozen=True)
class CellData:
    """The value of one factor within one run.

    ``coded`` is ``float`` because RSM families (CCD) use non-integer axial
    positions (±alpha) and centre points (0). The pure 2^k path still passes
    Python ``int`` values, which serialize to JSON ints (golden test intact).
    """

    coded: float
    natural: float | None = None
    label: str | None = None


@dataclass(frozen=True)
class RunData:
    """One row of the experimental matrix (OriginPro-style columns)."""

    run_order: int
    std_order: int
    point_type: int
    block: int
    replicate: int
    cells: dict[str, CellData]  # factor name -> value
    # Measured responses for an already-run table (retrospective materialize).
    # ``None`` for a freshly generated design (values entered in a later slice).
    response_values: dict[str, float] | None = None


@dataclass(frozen=True)
class GeneratedDesign:
    """The full generated matrix before persistence.

    ``resolution``/``aliasing`` are only filled by the fractional 2^(k-p)
    builder; every other family leaves the defaults (golden 2^k intact).
    """

    design_type: str
    factors: list[FactorData]
    responses: list[ResponseData]
    runs: list[RunData]
    resolution: int | None = None
    aliasing: list[str] | None = None


@dataclass
class PersistedDesign:
    """Identifiers assigned by the repository after saving a design."""

    experiment_id: int
    design_type: str
    factor_ids: dict[str, int] = field(default_factory=dict)  # name -> id
    response_ids: dict[str, int] = field(default_factory=dict)  # name -> id
    run_ids: list[int] = field(default_factory=list)

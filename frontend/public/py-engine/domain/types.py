"""Domain enums shared across schemas, services and persistence."""

from enum import StrEnum


class FactorType(StrEnum):
    """How a factor's levels are expressed."""

    QUANTITATIVE = "quantitative"  # numeric low/high (coded to -1/+1)
    QUALITATIVE = "qualitative"  # categorical labels (mapped to -1/+1)


class DesignType(StrEnum):
    """Supported design families across the RSM + screening/optimal slices."""

    FULL_FACTORIAL_2K = "full_factorial_2k"
    FRACTIONAL_FACTORIAL_2KP = "fractional_factorial_2kp"
    CENTRAL_COMPOSITE = "central_composite"
    BOX_BEHNKEN = "box_behnken"
    TAGUCHI = "taguchi"  # orthogonal array + S/N ratio
    PLACKETT_BURMAN = "plackett_burman"  # 2-level screening (multiples of 4)
    OPTIMAL = "optimal"  # D/I-optimal exchange design
    DSD = "dsd"  # Definitive Screening Design (Jones-Nachtsheim)
    FULL_FACTORIAL_GENERAL = "full_factorial_general"  # 3^k e níveis mistos (pyDOE3 fullfact)
    RETROSPECTIVE = "retrospective"  # materialized from a pasted (already-run) table


class SNObjective(StrEnum):
    """Taguchi Signal-to-Noise objective (larger/smaller/nominal is better)."""

    LARGER = "larger_is_better"
    SMALLER = "smaller_is_better"
    NOMINAL = "nominal_is_best"


class OptimalCriterion(StrEnum):
    """Optimality criterion for the exchange builder.

    - ``D``: maximizes det(X'X) — sharp coefficient estimates (screening).
    - ``I``: minimizes the average prediction variance — preferred for RSM.
    """

    D = "D"
    I = "I"  # noqa: E741 — "I" is the standard name of the I-optimality criterion


class CCDVariant(StrEnum):
    """Central Composite Design axial-distance variants.

    - ``ROTATABLE``: alpha = (2^k)^(1/4) — constant prediction variance on a
      sphere (pyDOE3 ``alpha='rotatable', face='circumscribed'``).
    - ``ORTHOGONAL``: alpha chosen so the quadratic model is orthogonal
      (``alpha='orthogonal', face='circumscribed'``).
    - ``FACE_CENTERED``: alpha = 1 — axial points on the cube faces
      (``face='faced'``), useful when factor ranges cannot be exceeded.
    """

    ROTATABLE = "rotatable"
    ORTHOGONAL = "orthogonal"
    FACE_CENTERED = "face_centered"


class RSMModel(StrEnum):
    """The four response-surface models from the class (aula).

    Term sets built by ``analysis_service.terms_for_model``:
    - ``LINEAR``: main effects only.
    - ``LINEAR_QUADRATIC``: main effects + pure quadratic terms.
    - ``LINEAR_INTERACTIONS``: main effects + all two-factor interactions.
    - ``FULL``: main effects + two-factor interactions + quadratics.
    """

    LINEAR = "linear"
    LINEAR_QUADRATIC = "linear_quadratic"
    LINEAR_INTERACTIONS = "linear_interactions"
    FULL = "full"


class PointType:
    """OriginPro-style point classification for a run.

    Pure 2^k designs only ever have factorial (corner) points.
    """

    FACTORIAL = 1
    CENTER = 0
    AXIAL = -1

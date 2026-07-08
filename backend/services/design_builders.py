"""Pure builders for the extended design families (issue 06).

Fractional factorial 2^(k-p), Central Composite (CCD), Box-Behnken (BBD) and
center-point augmentation. Same seam style as ``build_2k_design``: framework-
free, pyDOE3 as the single generation engine, explicit ±1 coding (ADR-005).
The ``DesignService`` dispatches here by ``DesignType``; nothing in this
module touches the golden 2^k path.
"""

import string
from dataclasses import replace
from itertools import combinations

import numpy as np
from pyDOE3 import bbdesign, ccdesign, fracfact, fracfact_by_res
from pyDOE3.doe_factorial import fracfact_aliasing

from domain.design import (
    CellData,
    FactorData,
    GeneratedDesign,
    ResponseData,
    RunData,
)
from domain.errors import DesignConfigError
from domain.schemas import (
    CCDConfig,
    DesignGenerateRequest,
    FactorSpec,
    ResponseSpec,
)
from domain.types import CCDVariant, DesignType, FactorType, PointType
from services.design_service import (
    MAX_FACTORS,
    _cell,
    _factor_levels,
    coded_to_natural,
)

_TOL = 1e-8

# pyDOE3 ``ccdesign`` arguments per CCD variant (face-centered forces alpha=1).
_CCD_ARGS: dict[CCDVariant, dict[str, str]] = {
    CCDVariant.ROTATABLE: {"alpha": "rotatable", "face": "circumscribed"},
    CCDVariant.ORTHOGONAL: {"alpha": "orthogonal", "face": "circumscribed"},
    CCDVariant.FACE_CENTERED: {"face": "faced"},
}


# --- shared assembly helpers --------------------------------------------------


def _validate_names(factors: list[FactorSpec]) -> None:
    names = [f.name for f in factors]
    if len(set(names)) != len(names):
        raise DesignConfigError("Nomes de fatores devem ser únicos.")
    if len(factors) > MAX_FACTORS:
        raise DesignConfigError(f"Número de fatores acima do limite ({MAX_FACTORS}).")


def _require_quantitative(factors: list[FactorSpec], family: str) -> None:
    bad = [f.name for f in factors if f.factor_type is not FactorType.QUANTITATIVE]
    if bad:
        raise DesignConfigError(
            f"{family} exige fatores quantitativos; qualitativo(s): {', '.join(bad)}."
        )


def _factor_meta(factors: list[FactorSpec]) -> list[FactorData]:
    return [
        FactorData(
            name=f.name,
            factor_type=f.factor_type.value,
            unit=f.unit,
            position=pos,
            levels=_factor_levels(f),
        )
        for pos, f in enumerate(factors)
    ]


def _response_meta(responses: list[ResponseSpec]) -> list[ResponseData]:
    return [
        ResponseData(name=r.name, unit=r.unit, position=pos)
        for pos, r in enumerate(responses)
    ]


def _classify_point(coded_row: list[float]) -> int:
    """OriginPro-style point type from one row of coded values.

    All ≈0 → center; exactly one non-zero (the ±alpha arm) → axial; anything
    else (cube corners, BBD edge midpoints) → factorial.
    """
    nonzero = [c for c in coded_row if abs(c) > _TOL]
    if not nonzero:
        return PointType.CENTER
    if len(nonzero) == 1:
        return PointType.AXIAL
    return PointType.FACTORIAL


def _quant_cell(factor: FactorSpec, coded: float) -> CellData:
    """Cell at an arbitrary coded position (centers, ±alpha axials)."""
    natural = coded_to_natural(coded, float(factor.low), float(factor.high))
    return CellData(coded=float(coded), natural=natural)


def _runs_from_matrix(
    matrix: np.ndarray, factors: list[FactorSpec], seed: int | None
) -> list[RunData]:
    """RunData rows (std order = pyDOE3 row order, randomized run order)."""
    rng = np.random.default_rng(seed)
    run_order = rng.permutation(len(matrix)) + 1
    return [
        RunData(
            run_order=int(run_order[i]),
            std_order=i + 1,
            point_type=_classify_point([float(v) for v in row]),
            block=1,
            replicate=1,
            cells={
                f.name: _quant_cell(f, float(row[pos]))
                for pos, f in enumerate(factors)
            },
        )
        for i, row in enumerate(matrix)
    ]


# --- fractional factorial 2^(k-p) ---------------------------------------------


def build_fractional_design(
    factors: list[FactorSpec],
    responses: list[ResponseSpec],
    req: DesignGenerateRequest,
) -> GeneratedDesign:
    """Build a 2^(k-p) fraction via pyDOE3 ``fracfact``/``fracfact_by_res``.

    Fills ``resolution`` (shortest defining word) and ``aliasing`` (confounding
    map with real factor names, ``"A = BC"`` style, plus the defining relation
    as ``"I = ..."``).
    """
    cfg = req.fractional
    if cfg is None:
        raise DesignConfigError(
            "Planejamento fracionado requer a configuração 'fractional'."
        )
    k = len(factors)
    if k < 2:
        raise DesignConfigError(
            "Um planejamento fracionado precisa de pelo menos 2 fatores."
        )
    _validate_names(factors)

    try:
        if cfg.generators is not None:
            words = cfg.generators.split()
            if len(words) != k:
                raise DesignConfigError(
                    f"Geradores inválidos: {k} fatores exigem {k} colunas "
                    f"geradoras, recebi {len(words)} ('{cfg.generators}')."
                )
            matrix = fracfact(cfg.generators)
        else:
            matrix = fracfact_by_res(k, cfg.resolution)
    except DesignConfigError:
        raise
    except ValueError as exc:
        raise DesignConfigError(f"Configuração fracionada inválida: {exc}") from exc

    resolution = _resolution(matrix)
    aliasing = _aliasing_readable(matrix, factors)

    # Replicate std rows (replicate-major) like build_2k_design, then randomize.
    rows: list[tuple[int, dict[str, CellData]]] = []  # (replicate, cells)
    for replicate in range(1, req.replicates + 1):
        for base_row in matrix:
            cells = {
                f.name: _cell(f, int(round(base_row[pos])))
                for pos, f in enumerate(factors)
            }
            rows.append((replicate, cells))

    rng = np.random.default_rng(req.seed)
    run_order = rng.permutation(len(rows)) + 1
    runs = [
        RunData(
            run_order=int(run_order[i]),
            std_order=i + 1,
            point_type=PointType.FACTORIAL,
            block=1,
            replicate=replicate,
            cells=cells,
        )
        for i, (replicate, cells) in enumerate(rows)
    ]

    return GeneratedDesign(
        design_type=DesignType.FRACTIONAL_FACTORIAL_2KP.value,
        factors=_factor_meta(factors),
        responses=_response_meta(responses),
        runs=runs,
        resolution=resolution,
        aliasing=aliasing,
    )


def _defining_words(matrix: np.ndarray) -> list[tuple[int, ...]]:
    """Column subsets whose product is a constant ±1 column.

    These are exactly the words of the defining relation (the GF(2) products
    of the generator words), found directly on the matrix so both the
    ``generators`` and the ``resolution`` paths share one implementation.
    """
    k = matrix.shape[1]
    words: list[tuple[int, ...]] = []
    for r in range(1, k + 1):
        for comb in combinations(range(k), r):
            prod = np.prod(matrix[:, comb], axis=1)
            if np.all(prod == prod[0]):
                words.append(comb)
    return words


def _resolution(matrix: np.ndarray) -> int | None:
    """Resolution = smallest Hamming weight among defining words (None if full)."""
    words = _defining_words(matrix)
    return min(len(w) for w in words) if words else None


def _aliasing_readable(
    matrix: np.ndarray, factors: list[FactorSpec]
) -> list[str]:
    """Human-readable confounding map with real factor names.

    Uses ``pyDOE3.fracfact_aliasing`` for the alias groups (letters a, b, c …
    in factor order) and translates each letter to the factor's real name.
    Single-letter names concatenate ("A = BC"); longer names join with '*'.
    """
    letter_to_name = {
        string.ascii_lowercase[i]: f.name for i, f in enumerate(factors)
    }
    single = all(len(f.name) == 1 for f in factors)

    def _word(letters: str) -> str:
        names = [letter_to_name[ch] for ch in letters]
        return "".join(names) if single else "*".join(names)

    groups, _cost = fracfact_aliasing(matrix)
    out: list[str] = []
    defining = [_word("".join(string.ascii_lowercase[i] for i in w))
                for w in _defining_words(matrix)]
    if defining:
        out.append("I = " + " = ".join(defining))
    for group in groups:
        if " = " not in group:
            continue  # unaliased contrast — nothing confounded
        out.append(" = ".join(_word(w) for w in group.split(" = ")))
    return out


# --- center points (2^k / fractional augmentation) ----------------------------


def add_center_points(
    base: GeneratedDesign,
    factors: list[FactorSpec],
    n: int,
    seed: int | None = None,
) -> GeneratedDesign:
    """Append ``n`` center runs (coded 0.0, natural midpoint) to ``base``.

    The full run order (base + centers) is re-randomized with ``seed`` so the
    centers are interspersed among the corners, as DoE practice requires.
    """
    if n < 1:
        return base
    _require_quantitative(factors, "Pontos centrais")

    max_std = max((r.std_order for r in base.runs), default=0)
    center_runs = [
        RunData(
            run_order=0,  # placeholder; re-randomized below
            std_order=max_std + i + 1,
            point_type=PointType.CENTER,
            block=1,
            replicate=1,
            cells={
                f.name: CellData(
                    coded=0.0, natural=(float(f.low) + float(f.high)) / 2
                )
                for f in factors
            },
        )
        for i in range(n)
    ]

    ordered = sorted([*base.runs, *center_runs], key=lambda r: r.std_order)
    rng = np.random.default_rng(seed)
    run_order = rng.permutation(len(ordered)) + 1
    runs = [
        replace(run, run_order=int(run_order[i])) for i, run in enumerate(ordered)
    ]
    return replace(base, runs=runs)


# --- Central Composite Design --------------------------------------------------


def build_ccd_design(
    factors: list[FactorSpec],
    responses: list[ResponseSpec],
    req: DesignGenerateRequest,
) -> GeneratedDesign:
    """Build a CCD via pyDOE3 ``ccdesign`` (variant → alpha/face mapping)."""
    cfg = req.ccd or CCDConfig()
    k = len(factors)
    if k < 2:
        raise DesignConfigError("Um CCD precisa de pelo menos 2 fatores.")
    _validate_names(factors)
    _require_quantitative(factors, "CCD")

    matrix = ccdesign(
        k,
        center=(cfg.center_factorial, cfg.center_axial),
        **_CCD_ARGS[cfg.variant],
    )
    return GeneratedDesign(
        design_type=DesignType.CENTRAL_COMPOSITE.value,
        factors=_factor_meta(factors),
        responses=_response_meta(responses),
        runs=_runs_from_matrix(matrix, factors, req.seed),
    )


# --- Box-Behnken ----------------------------------------------------------------


def build_bbd_design(
    factors: list[FactorSpec],
    responses: list[ResponseSpec],
    req: DesignGenerateRequest,
) -> GeneratedDesign:
    """Build a Box-Behnken design via pyDOE3 ``bbdesign``."""
    k = len(factors)
    if k < 3:
        raise DesignConfigError("Um Box-Behnken precisa de pelo menos 3 fatores.")
    _validate_names(factors)
    _require_quantitative(factors, "Box-Behnken")

    matrix = bbdesign(k, center=req.bbd_center)
    return GeneratedDesign(
        design_type=DesignType.BOX_BEHNKEN.value,
        factors=_factor_meta(factors),
        responses=_response_meta(responses),
        runs=_runs_from_matrix(matrix, factors, req.seed),
    )

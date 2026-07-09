"""Retrospective detection core — diagnoses which design a pasted table matches.

Pure module-level pipeline (no DB, no FastAPI), lane C part 1:
``parse_table`` → ``infer_factor_scales`` → ``classify_runs`` → ``detect_designs``.
Geometry is generated combinatorially (bitmask corners, GF(2) subgroup test for
regular fractions, C(k,2)×4 Box-Behnken edges); pyDOE3 stays a test-time oracle.
Bad cells NEVER raise: rows are excluded with a PT-BR ``RowIssue``.
"""

from dataclasses import dataclass, field
from itertools import combinations

from domain.schemas import (
    DesignMatchRead,
    FactorScaleRead,
    ReplicateInfoRead,
    RetroDiagnoseRequest,
    RowIssue,
    RunClassRead,
)

CODED_SNAP_TOL = 0.01  # |coded - target| below this snaps to the grid
LEVEL_CLUSTER_REL = 1e-6  # cluster atol = 1e-9 + rel * (max - min)
MIDPOINT_REL = 0.05  # 3-level regularity: |mid - midpoint| <= rel * range
ALPHA_MATCH_REL = 0.02  # CCD axial symmetry: ||a_low| - a_high| <= rel * a_high
MAX_ROWS = 5000  # mirrored by the Pydantic max_length on RetroDiagnoseRequest.rows
CORNER_ENUM_MAX_K = 10  # bitmask enumeration cap (2^10 = 1024 corners)

# ranking tie-break: simpler families first
_FAMILY_RANK = {
    "full_factorial_2k": 0,
    "fractional_factorial_2kp": 1,
    "full_factorial_3k": 2,
    "central_composite": 3,
    "box_behnken": 4,
    "irregular": 9,
}


# --- internal plain-data results ----------------------------------------------


@dataclass(frozen=True)
class ParsedRow:
    """One valid table row: factors parsed, responses parsed (None = not measured)."""

    row: int  # 1-based position in the original table
    factors: dict[str, float | str]
    responses: dict[str, float | None]


@dataclass(frozen=True)
class ParsedTable:
    """The parsed table plus the rows that had to be excluded."""

    factor_names: list[str]
    factor_types: dict[str, str]  # name -> "quantitative" | "qualitative"
    rows: list[ParsedRow]
    row_issues: list[RowIssue]


@dataclass(frozen=True)
class FactorScale:
    """The inferred coding scale of one factor (richer than FactorScaleRead)."""

    name: str
    factor_type: str
    n_levels: int
    is_constant: bool = False
    warnings: list[str] = field(default_factory=list)
    levels: list[float] | None = None  # quantitative cluster means, sorted
    low: float | None = None  # natural value at coded -1
    high: float | None = None  # natural value at coded +1
    center: float | None = None
    alpha: float | None = None  # CCD-candidate axial distance (coded units)
    labels: list[str] | None = None  # qualitative, first-appearance order
    label_map: dict[str, float] | None = None  # label -> ±1

    @property
    def active(self) -> bool:
        """Enters the ±1 coding (counts toward the detection k)."""
        if self.is_constant:
            return False
        if self.factor_type == "qualitative":
            return self.label_map is not None
        return self.low is not None and self.high is not None and self.high > self.low


def scale_to_read(scale: FactorScale) -> FactorScaleRead:
    """Convert the internal scale to its HTTP read model (part 2 uses this)."""
    return FactorScaleRead(
        name=scale.name, factor_type=scale.factor_type, low=scale.low, high=scale.high,
        center=scale.center, n_levels=scale.n_levels, distinct_levels=scale.levels,
        labels=scale.labels, alpha=scale.alpha, is_constant=scale.is_constant,
        warnings=scale.warnings,
    )


# --- 1. parsing -----------------------------------------------------------------


def _parse_number(text: str) -> float | None:
    """Spreadsheet-style numeric parse: strip + accept ',' or '.' decimals."""
    try:
        return float(text.strip().replace(",", "."))
    except ValueError:
        return None


def parse_table(req: RetroDiagnoseRequest) -> ParsedTable:
    """Parse raw string cells; infer column types; exclude bad rows with issues.

    A factor column typed "auto" becomes quantitative when EVERY non-empty cell
    is numeric, qualitative otherwise (labels stripped, case-sensitive). An
    explicit user type wins the inference. Empty/invalid factor cells exclude
    the row (readable PT-BR issue); empty responses are just "not measured".
    """
    factor_names = [f.name for f in req.factors]
    response_names = [r.name for r in req.responses]

    factor_types: dict[str, str] = {}
    for spec in req.factors:
        if spec.factor_type != "auto":
            factor_types[spec.name] = spec.factor_type
            continue
        non_empty = [
            text for row in req.rows if (text := (row.factors.get(spec.name) or "").strip())
        ]
        all_numeric = bool(non_empty) and all(_parse_number(t) is not None for t in non_empty)
        factor_types[spec.name] = "quantitative" if all_numeric else "qualitative"

    rows: list[ParsedRow] = []
    issues: list[RowIssue] = []
    for i, raw in enumerate(req.rows):
        row_no = i + 1
        cells: dict[str, float | str] = {}
        problem: str | None = None
        for name in factor_names:
            text = (raw.factors.get(name) or "").strip()
            if not text:
                problem = f"Linha {row_no}: valor do fator '{name}' está vazio."
                break
            if factor_types[name] == "quantitative":
                value = _parse_number(text)
                if value is None:
                    problem = f"Linha {row_no}: valor '{text}' do fator '{name}' não é numérico."
                    break
                cells[name] = value
            else:
                cells[name] = text
        if problem is not None:
            issues.append(RowIssue(row=row_no, message=problem))
            continue

        responses: dict[str, float | None] = {}
        for name in response_names:
            text = (raw.responses.get(name) or "").strip()
            if not text:
                responses[name] = None
                continue
            value = _parse_number(text)
            if value is None:
                issues.append(RowIssue(row=row_no, message=(
                    f"Linha {row_no}: resposta '{name}' com valor '{text}' não numérico; "
                    "tratada como não medida."
                )))
            responses[name] = value
        rows.append(ParsedRow(row=row_no, factors=cells, responses=responses))

    return ParsedTable(
        factor_names=factor_names, factor_types=factor_types, rows=rows, row_issues=issues
    )


# --- 2. factor scales -------------------------------------------------------------


def _cluster_levels(values: list[float]) -> list[float]:
    """Sorted unique levels: chain-cluster with atol tied to the factor range."""
    ordered = sorted(values)
    atol = 1e-9 + LEVEL_CLUSTER_REL * (ordered[-1] - ordered[0])
    clusters: list[list[float]] = [[ordered[0]]]
    for v in ordered[1:]:
        if v - clusters[-1][-1] <= atol:
            clusters[-1].append(v)
        else:
            clusters.append([v])
    return [sum(c) / len(c) for c in clusters]


def _qscale(name: str, n: int, **kw) -> FactorScale:
    return FactorScale(name=name, factor_type="quantitative", n_levels=n, **kw)


def _minmax_scale(name: str, levels: list[float], reason: str) -> FactorScale:
    """Irregular fallback: code by min/max so extremes still land on ±1."""
    return _qscale(
        name, len(levels), levels=levels, low=levels[0], high=levels[-1],
        center=(levels[0] + levels[-1]) / 2,
        warnings=[f"Fator '{name}': níveis irregulares ({reason})."],
    )


def _ccd_five_level(name: str, levels: list[float]) -> FactorScale | None:
    """{-α, -1, 0, +1, +α}: inner pair is the cube, middle the center, extremes ±α."""
    lo_ext, low, mid, high, hi_ext = levels
    half, center = (high - low) / 2, (low + high) / 2
    if half <= 0 or abs(mid - center) > MIDPOINT_REL * (high - low):
        return None
    a_low, a_high = (center - lo_ext) / half, (hi_ext - center) / half
    if a_high <= 0 or abs(a_low - a_high) > ALPHA_MATCH_REL * a_high:
        return None
    return _qscale(
        name, 5, levels=levels, low=low, high=high, center=center, alpha=(a_low + a_high) / 2
    )


def _ccd_four_level(name: str, levels: list[float]) -> FactorScale | None:
    """CCD with ONE axial run missing: {-α, -1, 0, +1} or {-1, 0, +1, +α}.

    Accepted only when exactly one interpretation fits (an equally spaced
    4-level column fits both and stays irregular). Needed so a CCD missing a
    single axial still diagnoses as a partial CCD.
    """
    fits: list[FactorScale] = []
    for cube_lo, cube_hi, mid, extreme in (
        (levels[1], levels[3], levels[2], levels[0]),  # -α present as levels[0]
        (levels[0], levels[2], levels[1], levels[3]),  # +α present as levels[3]
    ):
        half, center = (cube_hi - cube_lo) / 2, (cube_lo + cube_hi) / 2
        if half <= 0 or abs(mid - center) > MIDPOINT_REL * (cube_hi - cube_lo):
            continue
        alpha = abs(extreme - center) / half
        if alpha <= 1.0 + CODED_SNAP_TOL:
            continue
        fits.append(_qscale(
            name, 4, levels=levels, low=cube_lo, high=cube_hi, center=center, alpha=alpha,
            warnings=[f"Fator '{name}': possível ponto axial ausente (4 níveis)."],
        ))
    return fits[0] if len(fits) == 1 else None


def _quantitative_scale(name: str, values: list[float]) -> FactorScale:
    levels = _cluster_levels(values)
    n = len(levels)
    if n == 1:
        return _qscale(
            name, 1, is_constant=True, levels=levels,
            warnings=[f"Fator '{name}' não variou nos dados."],
        )
    if n == 2:
        low, high = levels
        return _qscale(name, 2, levels=levels, low=low, high=high, center=(low + high) / 2)
    if n == 3:
        low, mid, high = levels
        if abs(mid - (low + high) / 2) <= MIDPOINT_REL * (high - low):
            return _qscale(name, 3, levels=levels, low=low, high=high, center=(low + high) / 2)
        return _minmax_scale(name, levels, "nível intermediário fora do ponto médio")
    if n == 4 and (scale := _ccd_four_level(name, levels)) is not None:
        return scale
    if n == 5 and (scale := _ccd_five_level(name, levels)) is not None:
        return scale
    return _minmax_scale(name, levels, f"{n} níveis sem padrão reconhecido")


def _qualitative_scale(name: str, values: list[str]) -> FactorScale:
    labels: list[str] = []
    for v in values:  # first-appearance order
        if v not in labels:
            labels.append(v)
    n = len(labels)
    if n == 1:
        return FactorScale(
            name=name, factor_type="qualitative", n_levels=1, is_constant=True, labels=labels,
            warnings=[f"Fator '{name}' não variou nos dados."],
        )
    if n == 2:
        return FactorScale(
            name=name, factor_type="qualitative", n_levels=2, labels=labels,
            label_map={labels[0]: -1.0, labels[1]: 1.0},
        )
    return FactorScale(
        name=name, factor_type="qualitative", n_levels=n, labels=labels,
        warnings=[
            f"Fator '{name}' é categórico multinível ({n} categorias); a detecção de "
            "famílias de 2 níveis não se aplica a ele."
        ],
    )


def infer_factor_scales(parsed: ParsedTable) -> list[FactorScale]:
    """Infer the coding scale of every factor column (request order preserved)."""
    scales: list[FactorScale] = []
    for name in parsed.factor_names:
        values = [row.factors[name] for row in parsed.rows]
        if not values:
            scales.append(FactorScale(
                name=name, factor_type=parsed.factor_types[name], n_levels=0,
                is_constant=True, warnings=[f"Fator '{name}' sem dados válidos."],
            ))
        elif parsed.factor_types[name] == "quantitative":
            scales.append(_quantitative_scale(name, [float(v) for v in values]))
        else:
            scales.append(_qualitative_scale(name, [str(v) for v in values]))
    return scales


# --- 3. run classification ---------------------------------------------------------


def _snap(coded: float, alpha: float | None) -> float:
    targets = [0.0, -1.0, 1.0] if alpha is None else [0.0, -1.0, 1.0, -alpha, alpha]
    for target in targets:
        if abs(coded - target) <= CODED_SNAP_TOL:
            return target
    return coded


def _point_type(coded: dict[str, float], alphas: dict[str, float | None]) -> str:
    nonzero = {n: c for n, c in coded.items() if abs(c) > CODED_SNAP_TOL}
    on_cube = [c for c in nonzero.values() if abs(abs(c) - 1.0) <= CODED_SNAP_TOL]
    if not nonzero:
        return "center"
    if len(nonzero) == len(coded) and len(on_cube) == len(coded):
        return "factorial"
    if len(nonzero) == 1:
        ((name, c),) = nonzero.items()
        threshold = (alphas.get(name) or 1.0) - CODED_SNAP_TOL
        return "axial" if abs(c) >= threshold else "other"
    if len(coded) >= 3 and len(nonzero) == 2 and len(on_cube) == 2:
        return "edge"
    return "other"


def classify_runs(parsed: ParsedTable, scales: list[FactorScale]) -> list[RunClassRead]:
    """Code every row over the active factors, snap, classify and group replicates."""
    active = [s for s in scales if s.active]
    alphas = {s.name: s.alpha for s in active}
    groups: dict[tuple[float, ...], int] = {}
    runs: list[RunClassRead] = []
    for prow in parsed.rows:
        coded: dict[str, float] = {}
        for s in active:
            value = prow.factors[s.name]
            if s.factor_type == "qualitative":
                raw = s.label_map[str(value)]
            else:
                raw = (float(value) - s.center) / ((s.high - s.low) / 2)
            coded[s.name] = _snap(raw, s.alpha)
        key = tuple(round(coded[s.name], 6) for s in active)
        group = groups.setdefault(key, len(groups) + 1)
        runs.append(RunClassRead(
            row=prow.row, point_type=_point_type(coded, alphas), coded=coded,
            replicate_group=group,
        ))
    return runs


def replicate_info(runs: list[RunClassRead]) -> ReplicateInfoRead:
    """Pure-error structure: df_pure_error = sum over groups of (n_g - 1)."""
    counts: dict[int, int] = {}
    for run in runs:
        counts[run.replicate_group] = counts.get(run.replicate_group, 0) + 1
    sizes = list(counts.values())
    return ReplicateInfoRead(
        n_points_replicated=sum(1 for n in sizes if n >= 2),
        runs_per_point_max=max(sizes, default=0),
        df_pure_error=sum(n - 1 for n in sizes),
    )


# --- 4. design detection -------------------------------------------------------------


def _natural_point(
    signs: tuple[int, ...], active: list[FactorScale]
) -> dict[str, float | str | None]:
    """A coded ±1 corner converted to natural values / labels (missing_runs)."""
    out: dict[str, float | str | None] = {}
    for scale, sign in zip(active, signs, strict=True):
        if scale.factor_type == "qualitative":
            out[scale.name] = next(
                lb for lb, c in scale.label_map.items() if (c > 0) == (sign > 0)
            )
        else:
            out[scale.name] = scale.low if sign < 0 else scale.high
    return out


def _match_full_2k(
    corners: set[tuple[int, ...]], active: list[FactorScale], runs: list[RunClassRead]
) -> DesignMatchRead | None:
    """Full 2^k: complete when every bitmask corner is present, partial from 50%."""
    k = len(active)
    total = 2**k
    fullset = {tuple(1 if (mask >> j) & 1 else -1 for j in range(k)) for mask in range(total)}
    n_matched = len(corners & fullset)
    n_centers = sum(1 for r in runs if r.point_type == "center")
    n_corner_runs = sum(1 for r in runs if r.point_type == "factorial")
    if n_matched == total:
        reps = max(1, -(-n_corner_runs // total))  # ceil: max replicates per corner
        return DesignMatchRead(
            design_type="full_factorial_2k", status="complete", match_pct=100.0,
            n_matched=total, n_expected=total,
            detail=(
                f"Fatorial completo 2^{k}: todas as {total} combinações presentes "
                f"({n_corner_runs} corridas fatoriais, até {reps} réplica(s) por ponto); "
                f"{n_centers} ponto(s) central(is)."
            ),
        )
    if n_matched * 2 >= total:
        missing = sorted(fullset - corners)
        return DesignMatchRead(
            design_type="full_factorial_2k", status="partial",
            match_pct=100.0 * n_matched / total, n_matched=n_matched, n_expected=total,
            missing_runs=[_natural_point(t, active) for t in missing],
            detail=(
                f"Fatorial 2^{k} parcial: {n_matched} de {total} combinações presentes; "
                f"faltam {len(missing)} corrida(s)."
            ),
        )
    return None


def _gf2_basis(vectors: list[tuple[int, ...]]) -> list[list[int]]:
    """Row-echelon basis of a set of GF(2) vectors (Gaussian elimination)."""
    basis: list[list[int]] = []
    pivots: list[int] = []
    for vec in vectors:
        v = list(vec)
        for b, p in zip(basis, pivots, strict=True):
            if v[p]:
                v = [x ^ y for x, y in zip(v, b, strict=True)]
        for j, bit in enumerate(v):
            if bit:
                basis.append(v)
                pivots.append(j)
                break
    return basis


def _word_name(bits: tuple[int, ...], active: list[FactorScale]) -> str:
    """Factor names at the set bits: concatenated iff every name is one char."""
    names = [s.name for s, b in zip(active, bits, strict=True) if b]
    single = all(len(s.name) == 1 for s in active)
    return "".join(names) if single else "*".join(names)


def _match_fraction(
    corners: set[tuple[int, ...]], active: list[FactorScale]
) -> DesignMatchRead | None:
    """Closed GF(2) coset of corners -> regular 2^(k-p) fraction (complete).

    Corners map -1→0/+1→1, are translated by the first vector and tested for
    closure under XOR; the defining relation is the nullspace of the subgroup
    basis, each word signed by its (constant) column product on the data.
    """
    k = len(active)
    n = len(corners)
    if n < 2 or n & (n - 1) or n >= 2**k:
        return None
    ordered = sorted(corners)
    vecs = [tuple(1 if v > 0 else 0 for v in t) for t in ordered]
    t0 = vecs[0]
    translated = {tuple(a ^ b for a, b in zip(v, t0, strict=True)) for v in vecs}
    for a in translated:
        for b in translated:
            if tuple(x ^ y for x, y in zip(a, b, strict=True)) not in translated:
                return None  # not a regular fraction; the full-2^k partial covers it
    m = n.bit_length() - 1
    basis = _gf2_basis(sorted(translated))
    words: list[tuple[int, ...]] = []
    for mask in range(1, 2**k):
        bits = tuple((mask >> j) & 1 for j in range(k))
        if all(sum(b1 & b2 for b1, b2 in zip(bits, bv, strict=True)) % 2 == 0 for bv in basis):
            words.append(bits)
    signed: list[tuple[int, tuple[int, ...], int]] = []  # (weight, bits, sign)
    first = ordered[0]
    for bits in words:
        n_neg = sum(1 for value, bit in zip(first, bits, strict=True) if bit and value < 0)
        signed.append((sum(bits), bits, -1 if n_neg % 2 else 1))
    signed.sort(key=lambda w: (w[0], w[1]))
    resolution = signed[0][0]
    defining = "I = " + " = ".join(
        ("-" if sign < 0 else "") + _word_name(bits, active) for _, bits, sign in signed
    )
    aliasing: list[str] = []
    for j, scale in enumerate(active):
        parts = []
        for _, bits, sign in signed:
            alias = tuple(b ^ (1 if idx == j else 0) for idx, b in enumerate(bits))
            if any(alias):
                parts.append(("-" if sign < 0 else "") + _word_name(alias, active))
        if parts:
            aliasing.append(f"{scale.name} = " + " = ".join(parts))
    p = k - m
    return DesignMatchRead(
        design_type="fractional_factorial_2kp", variant=f"2^({k}-{p})", status="complete",
        match_pct=100.0, resolution=resolution, defining_relation=defining,
        aliasing=aliasing, n_matched=n, n_expected=n,
        detail=(
            f"Fração regular 2^({k}-{p}): {n} combinações fechadas sob XOR; "
            f"resolução {resolution}."
        ),
    )


def _match_ccd(
    runs: list[RunClassRead],
    active: list[FactorScale],
    corners: set[tuple[int, ...]],
    corners_complete: bool,
    corners_expected: int,
) -> DesignMatchRead | None:
    """CCD: complete cube/fraction + axial arms at ±α + at least one center."""
    if not corners_complete:
        return None
    quant = [s for s in active if s.factor_type == "quantitative"]
    if not quant:
        return None
    axial_runs = [r for r in runs if r.point_type == "axial"]
    n_centers = sum(1 for r in runs if r.point_type == "center")
    if not axial_runs or n_centers < 1:
        return None

    present: set[tuple[str, int]] = set()
    for run in axial_runs:
        name, c = next((n, c) for n, c in run.coded.items() if abs(c) > CODED_SNAP_TOL)
        present.add((name, 1 if c > 0 else -1))
    expected = {(s.name, sign) for s in quant for sign in (-1, 1)}
    covered = present & expected
    missing_runs: list[dict[str, float | str | None]] = []
    for name, sign in sorted(expected - covered):
        scale = next(s for s in quant if s.name == name)
        point: dict[str, float | str | None] = {s.name: s.center for s in quant}
        point[name] = scale.center + sign * (scale.alpha or 1.0) * (scale.high - scale.low) / 2
        missing_runs.append(point)

    alphas = [s.alpha or 1.0 for s in quant]
    alpha_mean = sum(alphas) / len(alphas)
    rotatable_target = (2 ** len(quant)) ** 0.25
    if all(abs(a - 1.0) <= ALPHA_MATCH_REL for a in alphas):
        variant = "face_centered"
    elif abs(alpha_mean - rotatable_target) <= ALPHA_MATCH_REL * rotatable_target:
        variant = "rotatable"
    else:
        variant = "custom"

    n_expected = corners_expected + len(expected) + 1
    n_matched = len(corners) + len(covered) + 1
    return DesignMatchRead(
        design_type="central_composite", variant=variant,
        status="complete" if not missing_runs else "partial",
        match_pct=100.0 * n_matched / n_expected, missing_runs=missing_runs,
        n_matched=n_matched, n_expected=n_expected,
        detail=(
            f"CCD ({variant}, α≈{alpha_mean:.3f}): cubo completo com {len(corners)} ponto(s), "
            f"{len(covered)}/{len(expected)} ponto(s) axial(is), "
            f"{n_centers} ponto(s) central(is)."
        ),
    )


def _match_bbd(runs: list[RunClassRead], active: list[FactorScale]) -> DesignMatchRead | None:
    """Box-Behnken: unique points only edges/centers, edges = C(k,2) pairs × 4 signs."""
    k = len(active)
    if k < 3 or any(s.factor_type != "quantitative" for s in active):
        return None
    if any(r.point_type not in ("edge", "center") for r in runs):
        return None
    names = [s.name for s in active]
    edges_present = {
        tuple(int(round(r.coded[n])) for n in names) for r in runs if r.point_type == "edge"
    }
    if not edges_present:
        return None
    expected: set[tuple[int, ...]] = set()
    for i, j in combinations(range(k), 2):
        for si in (-1, 1):
            for sj in (-1, 1):
                point = [0] * k
                point[i], point[j] = si, sj
                expected.add(tuple(point))
    covered = edges_present & expected
    missing = sorted(expected - covered)
    n_centers = sum(1 for r in runs if r.point_type == "center")
    missing_runs: list[dict[str, float | str | None]] = [
        {
            scale.name: scale.center if sign == 0 else (scale.low if sign < 0 else scale.high)
            for scale, sign in zip(active, point, strict=True)
        }
        for point in missing
    ]
    return DesignMatchRead(
        design_type="box_behnken", status="complete" if not missing else "partial",
        match_pct=100.0 * len(covered) / len(expected), missing_runs=missing_runs,
        n_matched=len(covered), n_expected=len(expected),
        detail=(
            f"Box-Behnken k={k}: {len(covered)}/{len(expected)} ponto(s) de aresta; "
            f"{n_centers} ponto(s) central(is)."
        ),
    )


def _match_3k(runs: list[RunClassRead], active: list[FactorScale]) -> DesignMatchRead | None:
    """Full 3^k: every unique point on the {-1, 0, +1}^k grid and all present."""
    k = len(active)
    if k < 2 or any(s.factor_type != "quantitative" for s in active):
        return None
    names = [s.name for s in active]
    points = {tuple(round(r.coded[n], 6) for n in names) for r in runs}
    if len(points) != 3**k:
        return None
    if any(c not in (-1.0, 0.0, 1.0) for point in points for c in point):
        return None
    return DesignMatchRead(
        design_type="full_factorial_3k", status="complete", match_pct=100.0,
        n_matched=3**k, n_expected=3**k,
        detail=f"Fatorial completo 3^{k}: todas as {3**k} combinações presentes.",
    )


def _irregular(match_pct: float, detail: str, n_matched: int, n_expected: int) -> DesignMatchRead:
    return DesignMatchRead(
        design_type="irregular", status="irregular", detail=detail, match_pct=match_pct,
        n_matched=n_matched, n_expected=n_expected,
    )


def _rank_key(match: DesignMatchRead) -> tuple:
    complete = match.status == "complete"
    return (
        0 if complete else 1,
        -match.n_expected if complete else 0,  # completes explaining more runs first
        -match.match_pct,
        len(match.missing_runs),
        _FAMILY_RANK.get(match.design_type, 99),
    )


def detect_designs(runs: list[RunClassRead], scales: list[FactorScale]) -> list[DesignMatchRead]:
    """Score every relevant design hypothesis over the unique ±1 corner set.

    Ranking: complete matches first (larger designs first), then partials by
    match_pct / fewest missing / simplest family. Always returns at least one
    entry (an ``irregular`` fallback when nothing fits).
    """
    active = [s for s in scales if s.active]
    k = len(active)
    if k == 0:
        return [_irregular(0.0, "Nenhum fator variou nos dados; nada a detectar.", 0, 0)]
    if k > CORNER_ENUM_MAX_K:
        detail = f"Mais de {CORNER_ENUM_MAX_K} fatores ativos; detecção não suportada."
        return [_irregular(0.0, detail, 0, 2**k)]
    names = [s.name for s in active]
    corners = {
        tuple(1 if r.coded[n] > 0 else -1 for n in names)
        for r in runs
        if r.point_type == "factorial"
    }

    full = _match_full_2k(corners, active, runs)
    fraction = _match_fraction(corners, active)
    full_complete = full is not None and full.status == "complete"
    ccd = _match_ccd(
        runs, active, corners,
        corners_complete=full_complete or fraction is not None,
        corners_expected=2**k if full_complete else len(corners),
    )
    candidates = (full, fraction, ccd, _match_bbd(runs, active), _match_3k(runs, active))
    matches = [match for match in candidates if match is not None]

    if not matches:
        matches.append(_irregular(
            100.0 * len(corners) / 2**k,
            "Os dados não correspondem a nenhuma família de planejamento suportada.",
            len(corners), 2**k,
        ))
    matches.sort(key=_rank_key)
    return matches

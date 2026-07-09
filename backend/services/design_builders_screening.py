"""Pure builders for the screening/optimal design families (issue 07).

Taguchi orthogonal arrays (+ S/N objective), Plackett-Burman, D/I-optimal
exchange designs and Definitive Screening Designs. Same seam style as
``design_builders`` (issue 06): framework-free, explicit ±1 coding (ADR-005),
``matrix_rank`` guard for optimal (ADR-007). pyDOE3 is the generation engine for
Taguchi/PB; the DSD core is vendored under ``vendor/dsd``.

The ``DesignService`` dispatches here by ``DesignType``; nothing here touches the
golden 2^k / RSM paths.
"""

from itertools import combinations

import numpy as np
from pyDOE3 import pbdesign
from pyDOE3.orthogonal_arrays import ORTHOGONAL_ARRAYS

from domain.design import (
    CellData,
    FactorData,
    GeneratedDesign,
    LevelData,
    ResponseData,
    RunData,
)
from domain.errors import DesignConfigError
from domain.schemas import (
    DesignGenerateRequest,
    DSDConfig,
    FactorSpec,
    OptimalConfig,
    ResponseSpec,
    TaguchiConfig,
)
from domain.types import DesignType, FactorType, OptimalCriterion, PointType, RSMModel
from vendor.dsd import compute_dsd

_TOL = 1e-9


# --- shared helpers -----------------------------------------------------------


def _validate_names(factors: list[FactorSpec]) -> None:
    names = [f.name for f in factors]
    if len(set(names)) != len(names):
        raise DesignConfigError("Nomes de fatores devem ser únicos.")


def _factor_nlevels(factor: FactorSpec) -> int:
    """How many levels this factor asks for (2 unless an explicit list is given)."""
    if factor.levels is not None and len(factor.levels) >= 2:
        return len(factor.levels)
    return 2


def _factor_level_values(factor: FactorSpec) -> list:
    """Ordered natural values / labels for each level of ``factor``."""
    if factor.levels is not None and len(factor.levels) >= 2:
        return list(factor.levels)
    if factor.factor_type is FactorType.QUANTITATIVE:
        return [float(factor.low), float(factor.high)]
    return [factor.low_label, factor.high_label]


def _response_meta(responses: list[ResponseSpec]) -> list[ResponseData]:
    return [
        ResponseData(name=r.name, unit=r.unit, position=pos)
        for pos, r in enumerate(responses)
    ]


def _coded_axis(n_levels: int) -> list[float]:
    """Symmetric ±1 coded positions for ``n_levels`` ordered levels.

    2 → [-1, 1]; 3 → [-1, 0, 1]; 4 → [-1, -1/3, 1/3, 1]; general even spacing.
    """
    if n_levels == 2:
        return [-1.0, 1.0]
    return [-1.0 + 2.0 * i / (n_levels - 1) for i in range(n_levels)]


def _multilevel_factor_meta(factors: list[FactorSpec]) -> list[FactorData]:
    """FactorData whose levels carry the full ordered coded<->value map."""
    out: list[FactorData] = []
    for pos, f in enumerate(factors):
        values = _factor_level_values(f)
        coded = _coded_axis(len(values))
        is_quant = f.factor_type is FactorType.QUANTITATIVE
        levels = [
            LevelData(
                coded=c,
                natural=float(v) if is_quant else None,
                label=None if is_quant else str(v),
            )
            for c, v in zip(coded, values, strict=True)
        ]
        out.append(
            FactorData(
                name=f.name,
                factor_type=f.factor_type.value,
                unit=f.unit,
                position=pos,
                levels=levels,
            )
        )
    return out


def _multilevel_cell(factor: FactorSpec, level_index: int) -> CellData:
    """Cell for ``factor`` at ordered ``level_index`` (0-based)."""
    values = _factor_level_values(factor)
    coded = _coded_axis(len(values))[level_index]
    value = values[level_index]
    if factor.factor_type is FactorType.QUANTITATIVE:
        return CellData(coded=float(coded), natural=float(value))
    return CellData(coded=float(coded), label=str(value))


def _runs_from_level_indices(
    index_matrix: np.ndarray, factors: list[FactorSpec], seed: int | None
) -> list[RunData]:
    """RunData rows from an integer level-index matrix (std order = row order)."""
    rng = np.random.default_rng(seed)
    run_order = rng.permutation(len(index_matrix)) + 1
    return [
        RunData(
            run_order=int(run_order[i]),
            std_order=i + 1,
            point_type=PointType.FACTORIAL,
            block=1,
            replicate=1,
            cells={
                f.name: _multilevel_cell(f, int(row[pos]))
                for pos, f in enumerate(factors)
            },
        )
        for i, row in enumerate(index_matrix)
    ]


# --- Taguchi orthogonal arrays ------------------------------------------------


def _oa_level_capacity(name: str) -> dict[int, int]:
    """{level_count: number of columns supporting it} for one catalog OA."""
    arr = np.asarray(ORTHOGONAL_ARRAYS[name])
    cap: dict[int, int] = {}
    for j in range(arr.shape[1]):
        lv = len({int(x) for x in arr[:, j]})
        cap[lv] = cap.get(lv, 0) + 1
    return cap


def taguchi_catalog() -> list[dict]:
    """Catalog rows (name, runs, columns, level capacity) sorted by run count."""
    rows = []
    for name, arr in ORTHOGONAL_ARRAYS.items():
        a = np.asarray(arr)
        rows.append(
            {
                "name": name,
                "runs": int(a.shape[0]),
                "n_columns": int(a.shape[1]),
                "level_capacity": _oa_level_capacity(name),
            }
        )
    rows.sort(key=lambda r: (r["runs"], r["n_columns"]))
    return rows


def _oa_fits(name: str, level_demand: dict[int, int]) -> bool:
    """Whether OA ``name`` has enough columns for each requested level count."""
    cap = _oa_level_capacity(name)
    for lv, need in level_demand.items():
        if cap.get(lv, 0) < need:
            return False
    return True


def _resolve_oa_name(raw: str) -> str:
    """Accept a full catalog name or a short "L8" prefix; else raise."""
    if raw in ORTHOGONAL_ARRAYS:
        return raw
    matches = [n for n in ORTHOGONAL_ARRAYS if n.split("(")[0] == raw]
    if len(matches) == 1:
        return matches[0]
    raise DesignConfigError(
        f"Arranjo Taguchi '{raw}' não encontrado. "
        f"Disponíveis: {', '.join(ORTHOGONAL_ARRAYS.keys())}."
    )


def _level_demand(factors: list[FactorSpec]) -> dict[int, int]:
    """{level_count: number of factors needing that many levels}."""
    demand: dict[int, int] = {}
    for f in factors:
        lv = _factor_nlevels(f)
        demand[lv] = demand.get(lv, 0) + 1
    return demand


def _auto_select_oa(level_demand: dict[int, int]) -> str:
    """Smallest OA (fewest runs) that hosts every factor; else raise."""
    for row in taguchi_catalog():
        if _oa_fits(row["name"], level_demand):
            return row["name"]
    raise DesignConfigError(
        "Nenhum arranjo Taguchi do catálogo comporta a combinação de níveis "
        f"solicitada ({level_demand})."
    )


def _assign_columns(name: str, factors: list[FactorSpec]) -> list[int]:
    """Assign each factor to a distinct OA column matching its level count.

    Raises with a concrete OA suggestion when the array cannot host the factors.
    """
    arr = np.asarray(ORTHOGONAL_ARRAYS[name])
    col_levels = [len({int(x) for x in arr[:, j]}) for j in range(arr.shape[1])]
    used: set[int] = set()
    assignment: list[int] = []
    for f in factors:
        need = _factor_nlevels(f)
        col = next(
            (j for j in range(len(col_levels)) if j not in used and col_levels[j] == need),
            None,
        )
        if col is None:
            suggestion = _auto_select_oa(_level_demand(factors))
            raise DesignConfigError(
                f"Fatores não cabem no arranjo {name}: fator '{f.name}' pede "
                f"{need} níveis e não há coluna livre. Use {suggestion}."
            )
        used.add(col)
        assignment.append(col)
    return assignment


def build_taguchi_design(
    factors: list[FactorSpec],
    responses: list[ResponseSpec],
    req: DesignGenerateRequest,
) -> GeneratedDesign:
    """Build a Taguchi OA design (auto-selecting the smallest fitting array)."""
    cfg = req.taguchi or TaguchiConfig()
    if not factors:
        raise DesignConfigError("Um planejamento Taguchi precisa de fatores.")
    _validate_names(factors)

    demand = _level_demand(factors)
    if cfg.array_name is not None:
        name = _resolve_oa_name(cfg.array_name)
        if not _oa_fits(name, demand):
            suggestion = _auto_select_oa(demand)
            raise DesignConfigError(
                f"Fatores não cabem no arranjo {name}. Use {suggestion}."
            )
    else:
        name = _auto_select_oa(demand)

    columns = _assign_columns(name, factors)
    oa = np.asarray(ORTHOGONAL_ARRAYS[name])
    index_matrix = oa[:, columns]  # (runs, k) of 0-based level indices

    return GeneratedDesign(
        design_type=DesignType.TAGUCHI.value,
        factors=_multilevel_factor_meta(factors),
        responses=_response_meta(responses),
        runs=_runs_from_level_indices(index_matrix, factors, req.seed),
        array_name=name,
    )


# --- Plackett-Burman ----------------------------------------------------------


def build_pb_design(
    factors: list[FactorSpec],
    responses: list[ResponseSpec],
    req: DesignGenerateRequest,
) -> GeneratedDesign:
    """Build a Plackett-Burman screening design via pyDOE3 ``pbdesign``.

    ``pbdesign(k)`` returns an (N, k) ±1 matrix where N is the next multiple of
    4 that is > k (Hadamard construction); extra columns are already trimmed.
    """
    k = len(factors)
    if k < 2:
        raise DesignConfigError("Um Plackett-Burman precisa de pelo menos 2 fatores.")
    _validate_names(factors)
    for f in factors:
        if _factor_nlevels(f) != 2:
            raise DesignConfigError(
                f"Plackett-Burman é 2-níveis; fator '{f.name}' pede outro número."
            )

    matrix = pbdesign(k).astype(int)  # (N, k) of ±1
    # Map ±1 → level index (0/1) for the shared run assembly.
    index_matrix = ((matrix + 1) // 2).astype(int)

    return GeneratedDesign(
        design_type=DesignType.PLACKETT_BURMAN.value,
        factors=_multilevel_factor_meta(factors),
        responses=_response_meta(responses),
        runs=_runs_from_level_indices(index_matrix, factors, req.seed),
    )


# --- D/I-optimal exchange -----------------------------------------------------


def _candidate_grid(factors: list[FactorSpec], n_levels: int) -> np.ndarray:
    """Full-factorial candidate set in coded space.

    Quantitative factors span ``n_levels`` evenly on [-1, 1]; qualitative
    factors always use their two labels (coded -1/+1).
    """
    axes = []
    for f in factors:
        if f.factor_type is FactorType.QUANTITATIVE:
            axes.append(_coded_axis(n_levels))
        else:
            axes.append([-1.0, 1.0])
    grid = np.array(np.meshgrid(*axes, indexing="ij")).reshape(len(factors), -1).T
    return grid


def _model_matrix(
    coded: np.ndarray, factors: list[FactorSpec], model: RSMModel
) -> np.ndarray:
    """Build the model matrix X for ``coded`` rows under an RSM ``model``.

    Categorical factors enter as a single ±1 dummy column (2 levels) — their
    interactions are kept but their pure quadratic is NEVER added (a squared
    ±1 dummy is a constant column → X'X singular; ADR guard).
    """
    n = coded.shape[0]
    cols = [np.ones(n)]  # intercept
    is_quant = [f.factor_type is FactorType.QUANTITATIVE for f in factors]
    k = len(factors)

    for j in range(k):  # main effects
        cols.append(coded[:, j])
    if model in (RSMModel.LINEAR_INTERACTIONS, RSMModel.FULL):
        for i, j in combinations(range(k), 2):
            cols.append(coded[:, i] * coded[:, j])
    if model in (RSMModel.LINEAR_QUADRATIC, RSMModel.FULL):
        for j in range(k):
            if is_quant[j]:  # skip categorical dummy² (constant column)
                cols.append(coded[:, j] ** 2)
    return np.column_stack(cols)


def _criterion_score(
    x: np.ndarray, criterion: OptimalCriterion, moment: np.ndarray | None
) -> float:
    """Higher is better. D: log-det(X'X). I: -trace((X'X)^-1 M) (moment M)."""
    xtx = x.T @ x
    if np.linalg.matrix_rank(xtx) < x.shape[1]:
        return -np.inf
    if criterion is OptimalCriterion.D:
        sign, logdet = np.linalg.slogdet(xtx)
        return logdet if sign > 0 else -np.inf
    inv = np.linalg.inv(xtx)
    return -float(np.trace(inv @ moment))


def build_optimal_design(
    factors: list[FactorSpec],
    responses: list[ResponseSpec],
    req: DesignGenerateRequest,
) -> GeneratedDesign:
    """Build a D- or I-optimal design by greedy point exchange (Fedorov-style).

    Starts from a random full-rank subset of the candidate grid, then swaps
    design↔candidate points while the chosen criterion improves. The final X is
    rank-checked (ADR-007): ``n_runs >= n_params`` and full column rank are
    enforced, otherwise a ``DesignConfigError`` is raised.
    """
    cfg = req.optimal
    if cfg is None:
        raise DesignConfigError("Planejamento ótimo requer a configuração 'optimal'.")
    k = len(factors)
    if k < 2:
        raise DesignConfigError("Um planejamento ótimo precisa de pelo menos 2 fatores.")
    _validate_names(factors)

    candidates = _candidate_grid(factors, cfg.n_levels)
    cand_x = _model_matrix(candidates, factors, cfg.model)
    n_params = cand_x.shape[1]
    if cfg.n_runs < n_params:
        raise DesignConfigError(
            f"n_runs={cfg.n_runs} é menor que o nº de parâmetros do modelo "
            f"({n_params}). Aumente n_runs para >= {n_params}."
        )

    moment = (cand_x.T @ cand_x) / cand_x.shape[0]  # I-optimal moment matrix
    sel = _greedy_exchange(candidates, factors, cfg, moment, req.seed)

    design_coded = candidates[sel]
    final_x = _model_matrix(design_coded, factors, cfg.model)
    if np.linalg.matrix_rank(final_x) < n_params:
        raise DesignConfigError(
            "Design ótimo resultou singular (posto incompleto); aumente n_runs "
            "ou reduza o modelo alvo."
        )
    eff = _d_efficiency(final_x, n_params)

    runs = _runs_from_coded(design_coded, factors, req.seed)
    return GeneratedDesign(
        design_type=DesignType.OPTIMAL.value,
        factors=_multilevel_factor_meta(factors),
        responses=_response_meta(responses),
        runs=runs,
        optimal_efficiency=eff,
    )


def _greedy_exchange(
    candidates: np.ndarray,
    factors: list[FactorSpec],
    cfg: OptimalConfig,
    moment: np.ndarray,
    seed: int | None,
) -> list[int]:
    """Return indices (into ``candidates``) of the selected design points."""
    rng = np.random.default_rng(seed)
    n_cand = candidates.shape[0]
    n_runs = cfg.n_runs

    def score(idx: list[int]) -> float:
        x = _model_matrix(candidates[idx], factors, cfg.model)
        return _criterion_score(x, cfg.criterion, moment)

    # Full-rank random start (retry a few times).
    sel: list[int] = []
    for _ in range(50):
        pick = rng.choice(n_cand, size=n_runs, replace=n_runs > n_cand).tolist()
        if np.isfinite(score(pick)):
            sel = pick
            break
    if not sel:  # degenerate fallback: cycle through candidates
        sel = [i % n_cand for i in range(n_runs)]

    best = score(sel)
    improved = True
    while improved:
        improved = False
        for pos in range(n_runs):
            current = sel[pos]
            for cand in range(n_cand):
                if cand == current:
                    continue
                sel[pos] = cand
                trial = score(sel)
                if trial > best + _TOL:
                    best = trial
                    current = cand
                    improved = True
                else:
                    sel[pos] = current
    return sel


def _d_efficiency(x: np.ndarray, n_params: int) -> float:
    """D-efficiency = (det(X'X)^(1/p)) / n_runs, in [0, 1] for coded designs."""
    xtx = x.T @ x
    sign, logdet = np.linalg.slogdet(xtx)
    if sign <= 0:
        return 0.0
    return float(np.exp(logdet / n_params) / x.shape[0])


def _runs_from_coded(
    coded: np.ndarray, factors: list[FactorSpec], seed: int | None
) -> list[RunData]:
    """RunData from a coded design matrix (optimal builder output)."""
    rng = np.random.default_rng(seed)
    run_order = rng.permutation(len(coded)) + 1
    runs: list[RunData] = []
    for i, row in enumerate(coded):
        cells: dict[str, CellData] = {}
        for pos, f in enumerate(factors):
            c = float(row[pos])
            if f.factor_type is FactorType.QUANTITATIVE:
                from services.design_service import coded_to_natural

                cells[f.name] = CellData(
                    coded=c, natural=coded_to_natural(c, float(f.low), float(f.high))
                )
            else:
                cells[f.name] = CellData(
                    coded=c, label=f.low_label if c < 0 else f.high_label
                )
        runs.append(
            RunData(
                run_order=int(run_order[i]),
                std_order=i + 1,
                point_type=PointType.FACTORIAL,
                block=1,
                replicate=1,
                cells=cells,
            )
        )
    return runs


# --- Definitive Screening Design ----------------------------------------------


def build_dsd_design(
    factors: list[FactorSpec],
    responses: list[ResponseSpec],
    req: DesignGenerateRequest,
) -> GeneratedDesign:
    """Build a DSD (vendored Jones-Nachtsheim). Categoricals are 2-level only.

    Continuous factors are coded -1/0/+1; the vendored core returns level codes
    1/2 for categorical columns (mapped to the low/high labels here). The
    de-aliasing property (main effects ⟂ all second-order terms) is a structural
    guarantee of the construction (asserted in tests).
    """
    _ = req.dsd or DSDConfig()
    k = len(factors)
    if k < 2:
        raise DesignConfigError("Um DSD precisa de pelo menos 2 fatores.")
    _validate_names(factors)

    quant = [f for f in factors if f.factor_type is FactorType.QUANTITATIVE]
    cat = [f for f in factors if f.factor_type is FactorType.QUALITATIVE]
    for f in cat:
        if _factor_nlevels(f) != 2:
            raise DesignConfigError(
                f"DSD categórico é 2-níveis; fator '{f.name}' pede outro número."
            )
    ordered = quant + cat  # continuous columns first, then categoricals
    matrix = compute_dsd(len(quant), len(cat))  # (rows, k) coded

    rng = np.random.default_rng(req.seed)
    run_order = rng.permutation(len(matrix)) + 1
    runs: list[RunData] = []
    for i, row in enumerate(matrix):
        cells: dict[str, CellData] = {}
        for pos, f in enumerate(ordered):
            v = float(row[pos])
            if f.factor_type is FactorType.QUANTITATIVE:
                natural = _dsd_natural(v, float(f.low), float(f.high))
                cells[f.name] = CellData(coded=v, natural=natural)
            else:  # categorical level code 1/2 → coded -1/+1
                coded = -1.0 if int(v) == 1 else 1.0
                label = f.low_label if coded < 0 else f.high_label
                cells[f.name] = CellData(coded=coded, label=label)
        pt = PointType.CENTER if np.allclose(row[: len(quant)], 0.0) else PointType.FACTORIAL
        runs.append(
            RunData(
                run_order=int(run_order[i]),
                std_order=i + 1,
                point_type=pt,
                block=1,
                replicate=1,
                cells=cells,
            )
        )

    return GeneratedDesign(
        design_type=DesignType.DSD.value,
        factors=_multilevel_factor_meta(ordered),
        responses=_response_meta(responses),
        runs=runs,
    )


def _dsd_natural(coded: float, low: float, high: float) -> float:
    """Coded -1/0/+1 → natural value (0 is the midpoint)."""
    center = (high + low) / 2
    half = (high - low) / 2
    return center + coded * half

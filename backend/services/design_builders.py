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
from pyDOE3 import bbdesign, ccdesign, fracfact, fracfact_by_res, fullfact
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
from services.design_builders_screening import (
    _multilevel_cell,
    _multilevel_factor_meta,
)
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
            matrix = _fraction_by_resolution(k, cfg.resolution)
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


def _fraction_by_resolution(k: int, resolution: int) -> np.ndarray:
    """Minimal 2^(k-p) fraction of resolution ``>= resolution``.

    ``pyDOE3.fracfact_by_res`` finds the smallest such fraction, but its search
    misses the maximal-resolution half-fraction (e.g. k=3 at any resolution, or
    k=4 resolution IV), raising ``ValueError('design not possible')``. Any
    fraction of ``k`` factors has resolution at most ``k`` — reached by the
    half-fraction whose single defining word is all ``k`` letters. So on that
    miss we fall back to that half-fraction when it meets the request, and only
    raise a clear, actionable error when no fraction can (``resolution > k``).
    """
    try:
        return fracfact_by_res(k, resolution)
    except ValueError:
        if resolution > k:
            raise DesignConfigError(
                f"Não existe fração de resolução {resolution} para {k} fatores: "
                f"a resolução máxima de uma fração de {k} fatores é {k}. Reduza a "
                f"resolução, use o modo 'Por geradores', ou o fatorial completo "
                f"2^{k} ({2**k} ensaios)."
            ) from None
        base = list(string.ascii_lowercase[: k - 1])
        # extra factor = product of every base factor → defining word length k.
        return fracfact(" ".join([*base, "".join(base)]))


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


def expandir_blocos_e_replicas(
    base: GeneratedDesign,
    blocks: int,
    replicates: int,
    seed: int | None = None,
) -> GeneratedDesign:
    """Repete o arranjo inteiro em ``blocks × replicates`` cópias.

    Generaliza a antiga ``replicar_runs`` (mantida abaixo como caso particular):
    bloco e réplica são a MESMA operação mecânica — repetir o arranjo inteiro —,
    o que muda é só o rótulo e o que ele significa pra análise. Um **bloco** é
    uma repetição sob uma condição conhecida DIFERENTE (lote de material, dia de
    moldagem, tipo de solo): uma fonte de variação que o estudo isola, mas não
    investiga. Uma **réplica** é repetição sob a MESMA condição (o erro puro).
    O total de ensaios é ``len(base.runs) * blocks * replicates``.

    Cada eixo só é RELOTULADO quando de fato se expande por ele (``> 1``); com
    eixo de tamanho 1 o campo do ensaio original é preservado tal como veio de
    ``base``. Essa regra é o que permite este mesmo expansor cobrir as duas
    famílias que já numeram réplica internamente (2^k e fracionado): chamando
    aqui com ``replicates=1`` e ``blocks=N``, o campo ``replicate`` (já correto,
    1..R do laço interno) não é tocado — só ``block`` passa a variar 1..N. Do
    lado oposto, ``blocks=1`` preserva o ``block=1`` que todo construtor de
    bloco único já usa, e só ``replicate`` passa a variar — reproduzindo
    exatamente o comportamento da antiga ``replicar_runs``.

    Ordem de montagem: bloco maior (todos os ensaios do bloco 1, depois do
    bloco 2, ...) e, dentro de um bloco, réplica maior. ``std_order`` sai único
    de 1 a N somando todos os blocos e réplicas; ``run_order`` é sorteado sobre
    o conjunto COMPLETO, para que blocos e réplicas fiquem intercalados na
    bancada — executar um bloco inteiro em sequência confundiria a condição do
    bloco com qualquer deriva do laboratório ao longo do tempo, que é
    justamente o que a aleatorização existe para evitar. ``point_type`` de cada
    ensaio é preservado, porque descreve a posição geométrica no arranjo, não a
    repetição.
    """
    if blocks < 1:
        raise DesignConfigError("O número de blocos deve ser >= 1.")
    if replicates < 1:
        raise DesignConfigError("O número de réplicas deve ser >= 1.")
    if blocks == 1 and replicates == 1:
        return base

    ordenados = sorted(base.runs, key=lambda r: r.std_order)
    expandidos: list[RunData] = []
    std_order = 0
    for b in range(1, blocks + 1):
        for r in range(1, replicates + 1):
            for run in ordenados:
                std_order += 1
                expandidos.append(
                    replace(
                        run,
                        std_order=std_order,
                        block=b if blocks > 1 else run.block,
                        replicate=r if replicates > 1 else run.replicate,
                        run_order=0,  # provisório; sorteado abaixo
                    )
                )

    rng = np.random.default_rng(seed)
    run_order = rng.permutation(len(expandidos)) + 1
    runs = [
        replace(run, run_order=int(run_order[i])) for i, run in enumerate(expandidos)
    ]
    return replace(base, runs=runs)


def replicar_runs(
    base: GeneratedDesign,
    replicates: int,
    seed: int | None = None,
) -> GeneratedDesign:
    """Repete o bloco inteiro de ensaios ``replicates`` vezes.

    Caso particular de ``expandir_blocos_e_replicas`` com um único bloco;
    mantida para não quebrar quem já chamava esta função diretamente. Existe
    desde a entrega anterior porque só ``build_2k_design`` e
    ``build_fractional_design`` expandiam réplicas por conta própria; as
    demais famílias devolviam sempre um único bloco com ``replicate=1``.
    """
    return expandir_blocos_e_replicas(base, blocks=1, replicates=replicates, seed=seed)


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


# --- Fatorial completo com n níveis (3^k e níveis mistos) ---------------------

_GENERAL_FACTORIAL_WARN_RUNS = 81  # acima disto: aviso (custo experimental alto)
_GENERAL_FACTORIAL_MAX_RUNS = 243  # acima disto: recusa (use CCD/Box-Behnken)


def _general_factorial_nlevels(factor: FactorSpec) -> int:
    """Nº de níveis de um fator: ``len(factor.levels)`` quando declarado, senão 2.

    Reimplementado aqui (em vez de reusar ``design_builders_screening._factor_nlevels``
    puro) porque aquela função *absorve* silenciosamente uma lista ``levels`` com
    menos de 2 elementos de volta para 2 níveis — bom o suficiente para os
    chamadores existentes (Taguchi/PB/DSD sempre validam a lista antes), mas aqui
    precisamos recusar explicitamente o caso degenerado (n=1), como pede o ADR
    desta família: um fator com um único nível não varia e não pode entrar no
    fatorial completo.
    """
    if factor.levels is not None:
        if len(factor.levels) < 2:
            raise DesignConfigError(
                f"Fator '{factor.name}': declare pelo menos 2 níveis "
                f"(recebi {len(factor.levels)})."
            )
        return len(factor.levels)
    return 2


def _classify_general_factorial_point(coded_row: list[float]) -> int:
    """Tipo de ponto de uma linha do fatorial completo com n níveis.

    NÃO reutiliza ``_classify_point``: aquela função lê "exatamente um valor
    codificado não-nulo" como ponto axial — regra correta para CCD/Box-Behnken,
    cujos únicos pontos fora dos vértices SÃO braços axiais. Aqui a geometria é
    outra: um fator de 4 níveis tem códigos intermediários em ±1/3, e uma linha
    como (±1/3, 0) de um fatorial misto 4×3 seria lida por ``_classify_point``
    como ponto axial — contaminando o agrupamento de erro puro e a linha de
    curvatura da ANOVA com pontos que são, na verdade, vértices do reticulado
    (grid) do fatorial. Regra própria: só a linha com TODOS os códigos em zero
    (o centro exato, alcançável apenas quando todo fator tem nº ímpar de
    níveis) é CENTER; qualquer outra linha é um vértice FACTORIAL do grid.
    """
    if all(abs(c) <= _TOL for c in coded_row):
        return PointType.CENTER
    return PointType.FACTORIAL


def _runs_from_general_factorial(
    index_matrix: np.ndarray, factors: list[FactorSpec], seed: int | None
) -> list[RunData]:
    """RunData a partir da matriz de índices (0..n-1) devolvida por ``fullfact``."""
    rng = np.random.default_rng(seed)
    run_order = rng.permutation(len(index_matrix)) + 1
    runs: list[RunData] = []
    for i, row in enumerate(index_matrix):
        cells = {
            f.name: _multilevel_cell(f, int(row[pos])) for pos, f in enumerate(factors)
        }
        coded_row = [cells[f.name].coded for f in factors]
        runs.append(
            RunData(
                run_order=int(run_order[i]),
                std_order=i + 1,
                point_type=_classify_general_factorial_point(coded_row),
                block=1,
                replicate=1,
                cells=cells,
            )
        )
    return runs


def build_general_factorial_design(
    factors: list[FactorSpec],
    responses: list[ResponseSpec],
    req: DesignGenerateRequest,
) -> GeneratedDesign:
    """Build a fatorial completo com n níveis por fator (3^k / níveis mistos).

    Usa pyDOE3 ``fullfact``, que devolve uma matriz de ÍNDICES inteiros por
    coluna (0..n-1) — diferente de ``ff2n``/``ccdesign``, que já devolvem a
    posição codificada. O nº de níveis de cada fator vem de ``len(f.levels)``
    quando declarado, senão 2 (fator quantitativo low/high clássico). Valor
    natural e código ±1 seguem a mesma convenção multi-nível já usada pelos
    construtores Taguchi/PB/DSD (``_multilevel_cell``/``_factor_level_values``):
    código = -1 + 2*índice/(n-1), natural = ``f.levels[índice]`` (ou low/high).
    Fator qualitativo segue restrito a 2 rótulos nesta entrega (multinível
    qualitativo é fase 2, fora de escopo).
    """
    k = len(factors)
    # k=1 é aceito pelo mesmo motivo do 2^k (ver design_service.build_2k_design):
    # um fator quantitativo em 3+ níveis dentro de blocos é um RCBD legítimo
    # (o caso do pesquisador com % de fibra em 3 níveis, 4 blocos -- 12
    # ensaios). Sem bloco/réplica o desenho satura, mas a recusa correta é o
    # guard de estimabilidade da análise (ADR-007), não esta geração.
    if k < 1:
        raise DesignConfigError(
            "Um fatorial completo com níveis precisa de pelo menos 1 fator."
        )
    _validate_names(factors)

    for f in factors:
        if (
            f.factor_type is FactorType.QUALITATIVE
            and f.levels is not None
            and len(f.levels) > 2
        ):
            raise DesignConfigError(
                f"Fator qualitativo '{f.name}' com mais de 2 níveis ainda não é "
                "suportado nesta versão (multinível qualitativo é uma fase futura); "
                "use no máximo os 2 rótulos baixo/alto."
            )

    n_levels = [_general_factorial_nlevels(f) for f in factors]
    n_runs = int(np.prod(n_levels))
    resumo = "×".join(str(n) for n in n_levels)

    if n_runs > _GENERAL_FACTORIAL_MAX_RUNS:
        raise DesignConfigError(
            f"Fatorial completo com {n_runs} ensaios ({resumo} níveis) é grande "
            f"demais para esta família (limite {_GENERAL_FACTORIAL_MAX_RUNS}). "
            "Considere um composto central (CCD) ou um Box-Behnken para explorar "
            "a região com bem menos ensaios."
        )

    notes: list[str] | None = None
    if n_runs > _GENERAL_FACTORIAL_WARN_RUNS:
        notes = [
            f"Este fatorial completo tem {n_runs} ensaios ({resumo} níveis): "
            "considere um composto central (CCD) ou um Box-Behnken se o custo "
            "experimental for uma restrição."
        ]

    index_matrix = fullfact(n_levels).astype(int)  # (n_runs, k) índices 0..n-1

    return GeneratedDesign(
        design_type=DesignType.FULL_FACTORIAL_GENERAL.value,
        factors=_multilevel_factor_meta(factors),
        responses=_response_meta(responses),
        runs=_runs_from_general_factorial(index_matrix, factors, req.seed),
        notes=notes,
    )

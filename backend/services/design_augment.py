"""Evolução de um design existente (augmentation) — Fase B da auditoria 2026-07.

Funções puras (sem DB/HTTP): recebem o design persistido no shape do frontend
(fatores com níveis + runs) e devolvem APENAS os runs novos a anexar, com
``response_values`` vazios. A persistência (ids, append) fica na camada de
armazenamento (IndexedDB no browser; repos no backend).

Três operações clássicas:
- ``center_points``  — n pontos centrais (verificação de curvatura);
- ``extend_ccd``     — bloco axial (±α) + centrais: 2^k medido vira CCD
                        preservando os ensaios fatoriais já executados;
- ``replicates``     — réplica extra da matriz fatorial (erro puro).
"""

from __future__ import annotations

from domain.errors import DesignConfigError
from domain.types import PointType

ROTATABLE = "rotatable"
FACE_CENTERED = "face_centered"


def _quant_factors(factors: list[dict]) -> list[dict]:
    quant = [f for f in factors if f.get("factor_type") == "quantitative"]
    if len(quant) != len(factors):
        raise DesignConfigError(
            "Evoluir o planejamento exige fatores quantitativos "
            "(pontos centrais/axiais nao existem para fatores qualitativos)."
        )
    return quant


def _bounds(factor: dict) -> tuple[float, float]:
    lows = [lv for lv in factor.get("levels", []) if lv.get("coded_value") == -1]
    highs = [lv for lv in factor.get("levels", []) if lv.get("coded_value") == 1]
    if not lows or not highs or lows[0].get("natural_value") is None:
        raise DesignConfigError(
            f"Fator '{factor.get('name')}' sem niveis naturais definidos."
        )
    return float(lows[0]["natural_value"]), float(highs[0]["natural_value"])


def _cell(factor: dict, coded: float) -> dict:
    low, high = _bounds(factor)
    center = (low + high) / 2.0
    half = (high - low) / 2.0
    return {"coded": coded, "natural": center + coded * half, "label": None}


def _next_orders(runs: list[dict]) -> tuple[int, int, int]:
    max_run = max((int(r["run_order"]) for r in runs), default=0)
    max_std = max((int(r["std_order"]) for r in runs), default=0)
    max_block = max((int(r.get("block", 1) or 1) for r in runs), default=1)
    return max_run, max_std, max_block


def augment_design(design: dict, option: dict) -> dict:
    """Retorna ``{"new_runs": [...], "note": str}`` no shape RunRead (sem ids)."""
    factors = design.get("factors", [])
    runs = design.get("runs", [])
    responses = [r["name"] for r in design.get("responses", [])]
    kind = option.get("kind")
    max_run, max_std, max_block = _next_orders(runs)
    empty = {name: None for name in responses}

    def run_row(i: int, cells: dict, point_type: int, block: int, replicate: int = 1) -> dict:
        return {
            "run_order": max_run + i,
            "std_order": max_std + i,
            "point_type": point_type,
            "block": block,
            "replicate": replicate,
            "factors": cells,
            "response_values": dict(empty),
        }

    if kind == "center_points":
        n = int(option.get("n", 3))
        if n < 1:
            raise DesignConfigError("Informe quantos pontos centrais adicionar (>= 1).")
        quant = _quant_factors(factors)
        new_runs = [
            run_row(i + 1, {f["name"]: _cell(f, 0.0) for f in quant}, PointType.CENTER, max_block)
            for i in range(n)
        ]
        note = (
            f"{n} ponto(s) central(is) adicionados. Com as respostas medidas, a "
            "ANOVA ganha o teste de curvatura."
        )
        return {"new_runs": new_runs, "note": note}

    if kind == "extend_ccd":
        quant = _quant_factors(factors)
        k = len(quant)
        variant = option.get("variant", ROTATABLE)
        alpha = (2**k) ** 0.25 if variant == ROTATABLE else 1.0
        n_center = int(option.get("n_center", 3))
        block = max_block + 1
        new_runs: list[dict] = []
        i = 0
        for f in quant:
            for signal in (-1.0, 1.0):
                i += 1
                cells = {
                    g["name"]: _cell(g, alpha * signal if g["name"] == f["name"] else 0.0)
                    for g in quant
                }
                new_runs.append(run_row(i, cells, PointType.AXIAL, block))
        for _ in range(max(0, n_center)):
            i += 1
            new_runs.append(
                run_row(i, {f["name"]: _cell(f, 0.0) for f in quant}, PointType.CENTER, block)
            )
        note = (
            f"Bloco axial adicionado (alfa = {alpha:.5f}, {2 * k} pontos axiais + "
            f"{n_center} centrais, bloco {block}). Com as respostas medidas, o "
            "modelo Linear + Quadratico (superficie de resposta) fica estimavel; "
            "o bloco entra na analise automaticamente."
        )
        return {"new_runs": new_runs, "note": note}

    if kind == "replicates":
        n = int(option.get("n", 1))
        if n < 1:
            raise DesignConfigError("Informe quantas replicas extras adicionar (>= 1).")
        base = [r for r in runs if int(r.get("point_type", PointType.FACTORIAL)) == PointType.FACTORIAL]
        if not base:
            base = runs
        max_rep = max((int(r.get("replicate", 1) or 1) for r in runs), default=1)
        new_runs = []
        i = 0
        for rep in range(1, n + 1):
            for r in base:
                i += 1
                new_runs.append(
                    run_row(
                        i,
                        {k2: dict(v) for k2, v in r["factors"].items()},
                        int(r.get("point_type", PointType.FACTORIAL)),
                        int(r.get("block", 1) or 1),
                        replicate=max_rep + rep,
                    )
                )
        note = (
            f"{len(new_runs)} ensaio(s) de replica adicionados. Replicas melhoram a "
            "estimativa do erro puro e destravam o teste de falta de ajuste."
        )
        return {"new_runs": new_runs, "note": note}

    raise DesignConfigError(f"Operacao de evolucao desconhecida: {kind!r}.")

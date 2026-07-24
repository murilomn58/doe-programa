"""Smoke test local do engine (mesmo caminho que o worker Pyodide vai usar).

Roda com o Python do repo (deps do backend instaladas):
    cd frontend/public/py-engine && python _smoke_test.py
Valida: generate_design -> bundle -> analyze -> profiler -> export_plot -> retro.
NAO vai para o browser (excluido da lista de arquivos montados pelo worker).
"""

import asyncio
import base64
import json
import sys

import engine_api


def bundle_from_design(design_read: dict, y_values: list[float]) -> dict:
    """Monta o bundle (o que o store.ts fara) a partir do DesignRead + respostas."""
    runs = []
    for i, r in enumerate(design_read["runs"]):
        runs.append(
            {
                "id": i + 1,
                "run_order": r["run_order"],
                "std_order": r["std_order"],
                "point_type": r["point_type"],
                "block": r["block"],
                "replicate": r["replicate"],
                "cells": {
                    name: {
                        "coded": c["coded"],
                        "natural": c.get("natural"),
                        "label": c.get("label"),
                    }
                    for name, c in r["factors"].items()
                },
                "response_values": {"MR": y_values[i]},
            }
        )
    return {
        "experiment": {"id": 1, "name": "smoke", "description": None},
        "factors": [
            {
                "id": i + 1,
                "name": f["name"],
                "factor_type": f["factor_type"],
                "unit": f.get("unit"),
                "position": f["position"],
                "levels": f["levels"],
            }
            for i, f in enumerate(design_read["factors"])
        ],
        "responses": [
            {"id": 1, "name": "MR", "unit": "MPa", "position": 0},
        ],
        "runs": runs,
    }


async def main() -> int:
    # 1. catalogo Taguchi
    cat = engine_api.taguchi_catalog()
    assert cat["arrays"], "catalogo vazio"
    print(f"OK taguchi_catalog: {len(cat['arrays'])} arrays")

    # 2. gerar 2^3 com 1 replica
    req = {
        "design_type": "full_factorial_2k",
        "replicates": 1,
        "factors": [
            {"name": "Temperatura", "factor_type": "quantitative", "unit": "C", "low": 150, "high": 190},
            {"name": "Tempo", "factor_type": "quantitative", "unit": "min", "low": 30, "high": 60},
            {"name": "Catalisador", "factor_type": "qualitative", "low_label": "A", "high_label": "B"},
        ],
        "responses": [{"name": "MR", "unit": "MPa"}],
        "seed": 42,
    }
    design = engine_api.generate_design(req)
    assert design["n_runs"] == 8, f"esperava 8 runs, veio {design['n_runs']}"
    print(f"OK generate_design: {design['n_runs']} runs, tipo {design['design_type']}")

    # 3. bundle + analyze (respostas com efeito forte de Temperatura)
    # y = 100 + 15*T + 5*tempo + 2*T*tempo + ruido pequeno deterministico
    ys = []
    for r in sorted(design["runs"], key=lambda x: x["run_order"]):
        t = r["factors"]["Temperatura"]["coded"]
        tm = r["factors"]["Tempo"]["coded"]
        ys.append(100 + 15 * t + 5 * tm + 2 * t * tm + 0.3 * r["std_order"] % 1.7)
    bundle = bundle_from_design(design, ys)

    a_req = {"experiment_id": 1, "response_name": "MR", "model": "linear"}
    result = await engine_api.analyze(bundle, a_req)
    assert result["estimable"], "modelo nao estimavel"
    anova_sources = [row["source"] for row in result["anova"]]
    assert "Temperatura" in anova_sources, anova_sources
    r2 = result["r_squared"]
    print(f"OK analyze: estimable, R2={r2:.4f}, ANOVA={anova_sources}")
    assert result["plots"] is not None, "sem plots"
    assert result["plots"]["pareto"] is not None, "sem pareto"
    assert result["plots"]["main_effects"], "sem main effects"
    print(f"OK plots: pareto {len(result['plots']['pareto']['terms'])} termos, "
          f"{len(result['plots']['main_effects'])} main effects, "
          f"surface={'sim' if result['plots']['surface'] else 'nao'}")

    # 4. profiler
    p_req = {
        "experiment_id": 1, "response_name": "MR", "model": "linear",
        "point": {"Temperatura": 0.5, "Tempo": -0.5, "Catalisador": 0}, "maximize": True,
    }
    prof = await engine_api.profiler(bundle, p_req)
    assert prof["prediction"] is not None
    print(f"OK profiler: pred={prof['prediction']:.2f}, slices={len(prof['slices'])}, "
          f"optimum={prof['optimum']['value']:.2f}")

    # 5. export_plot (pareto PNG 600dpi + surface SVG)
    exp = await engine_api.export_plot(bundle, 1, "MR", "linear", "pareto", "png", dpi=300)
    png = base64.b64decode(exp["content_b64"])
    assert png[:8] == b"\x89PNG\r\n\x1a\n", "nao e PNG"
    print(f"OK export_plot pareto PNG: {len(png)/1024:.0f} KB, {exp['filename']}")
    exp2 = await engine_api.export_plot(bundle, 1, "MR", "linear", "main_effects", "svg")
    svg = base64.b64decode(exp2["content_b64"])
    assert b"<svg" in svg[:600], "nao e SVG"
    print(f"OK export_plot main_effects SVG: {len(svg)/1024:.0f} KB")
    exp3 = await engine_api.export_plot(bundle, 1, "MR", "linear", "pareto", "pdf")
    pdf = base64.b64decode(exp3["content_b64"])
    assert pdf[:5] == b"%PDF-", "nao e PDF"
    print(f"OK export_plot pareto PDF: {len(pdf)/1024:.0f} KB")

    # 6. retrospectiva (diagnose + materialize puros)
    rows = []
    for r in sorted(design["runs"], key=lambda x: x["run_order"]):
        rows.append({
            "factors": {
                "Temperatura": str(r["factors"]["Temperatura"]["natural"]),
                "Tempo": str(r["factors"]["Tempo"]["natural"]),
                "Catalisador": r["factors"]["Catalisador"]["label"] or "",
            },
            "responses": {"MR": f"{ys[r['run_order'] - 1]:.2f}"},
        })
    d_req = {
        "factors": [
            {"name": "Temperatura", "factor_type": "auto"},
            {"name": "Tempo", "factor_type": "auto"},
            {"name": "Catalisador", "factor_type": "auto"},
        ],
        "responses": [{"name": "MR"}],
        "rows": rows,
    }
    diag = engine_api.retro_diagnose(d_req)
    print(f"OK retro_diagnose: best_design={diag.get('best_design')}, "
          f"matches={len(diag.get('design_matches', []))}")
    mat = engine_api.retro_materialize({**d_req, "name": "Retro smoke"})
    assert mat["n_runs"] > 0
    print(f"OK retro_materialize: {mat['n_runs']} runs, tipo {mat['design_type']}")

    print("\nSMOKE TEST 100% VERDE")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

"""Browser engine facade: JSON in -> the SAME validated Python core -> JSON out.

This is the only new Python file the browser build adds. It replaces the HTTP
routers + SQLAlchemy repositories with:

* ``InMemoryRepo`` — hydrates the plain ``domain.models`` stand-ins from a JSON
  bundle handed over by the TypeScript layer (IndexedDB is the real store);
* thin async wrappers that reuse the REAL services (``AnalysisService``,
  ``PublicationService``) and the pure builders (``_build_design``,
  ``retrospective_analysis.diagnose``, ``_build_retrospective_design``), then
  serialize through the SAME Pydantic read schemas the FastAPI app used, so the
  frontend receives byte-identical shapes.

Nothing here re-implements math: single source of truth preserved (see
CLAUDE.md rule "calculos matematicos SEMPRE no backend Python").
"""

from __future__ import annotations

import base64
import math
from dataclasses import asdict

from domain.models import Experiment, Factor, Level, Response, Run
from domain.schemas import (
    AnalysisRequest,
    DesignGenerateRequest,
    ProfilerRequest,
    RetroDiagnoseRequest,
    RetroDiagnoseResponse,
    RetroMaterializeRequest,
    TaguchiArrayRead,
    TaguchiCatalogRead,
)
from domain.types import RSMModel
from domain.design import PersistedDesign
from services.analysis_service import AnalysisService
from services.design_service import _build_design, _to_design_read
from services import retrospective_analysis
from services.retrospective_service_materialize import _build_retrospective_design
from services.read_mappers import _profiler_to_read, _to_read


# --- sanitization (mirrors routers/retrospective.py) --------------------------


def _sanitize(value):
    """Recursively map NaN/inf floats to None so the JSON stays valid."""
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, dict):
        return {k: _sanitize(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize(v) for v in value]
    return value


# --- in-memory repository ------------------------------------------------------


class InMemoryRepo:
    """Implements every repo Protocol the services consume, from a JSON bundle.

    Bundle shape (produced by src/engine/store.ts):
    ``{"experiment": {...}, "factors": [{..., "levels": [...]}, ...],
       "responses": [...], "runs": [{..., "cells": {...}, "response_values": {...}}]}``
    """

    def __init__(self, bundle: dict) -> None:
        exp = bundle.get("experiment") or {}
        self._experiment = Experiment(
            id=exp.get("id"),
            name=exp.get("name", ""),
            description=exp.get("description"),
        )
        self._factors = [
            Factor(
                id=f.get("id"),
                experiment_id=exp.get("id"),
                name=f["name"],
                factor_type=f["factor_type"],
                unit=f.get("unit"),
                position=f.get("position", i),
                levels=[
                    Level(
                        coded_value=lv["coded_value"],
                        natural_value=lv.get("natural_value"),
                        label=lv.get("label"),
                    )
                    for lv in f.get("levels", [])
                ],
            )
            for i, f in enumerate(bundle.get("factors", []))
        ]
        self._responses = [
            Response(
                id=r.get("id"),
                experiment_id=exp.get("id"),
                name=r["name"],
                unit=r.get("unit"),
                position=r.get("position", i),
            )
            for i, r in enumerate(bundle.get("responses", []))
        ]
        self._runs = [
            Run(
                id=r.get("id"),
                experiment_id=exp.get("id"),
                run_order=r["run_order"],
                std_order=r["std_order"],
                point_type=r.get("point_type", 0),
                block=r.get("block", 1),
                replicate=r.get("replicate", 1),
                cells=r.get("cells", {}),
                response_values=r.get("response_values", {}),
            )
            for r in bundle.get("runs", [])
        ]

    async def get_experiment(self, experiment_id: int) -> Experiment | None:
        return self._experiment

    async def get_factors(self, experiment_id: int) -> list[Factor]:
        return self._factors

    async def get_responses(self, experiment_id: int) -> list[Response]:
        return self._responses

    async def get_runs(self, experiment_id: int) -> list[Run]:
        return self._runs


# --- public API (called from the worker) ---------------------------------------


def taguchi_catalog() -> dict:
    from services.design_builders_screening import taguchi_catalog as _catalog

    read = TaguchiCatalogRead(
        arrays=[
            TaguchiArrayRead(
                name=row["name"],
                runs=row["runs"],
                n_columns=row["n_columns"],
                level_capacity=row["level_capacity"],
            )
            for row in _catalog()
        ]
    )
    return _sanitize(read.model_dump(mode="json"))


def generate_design(req: dict) -> dict:
    """Pure generation; persistence happens in TS. ids come back as null."""
    request = DesignGenerateRequest.model_validate(req)
    design = _build_design(request)
    read = _to_design_read(0, design, PersistedDesign(experiment_id=0, design_type=design.design_type))
    payload = _sanitize(read.model_dump(mode="json"))
    # extra: raw levels/cells already inside read; TS persists and fills ids.
    return payload


async def analyze(bundle: dict, req: dict) -> dict:
    request = AnalysisRequest.model_validate(req)
    service = AnalysisService(InMemoryRepo(bundle))
    result = await service.analyze(
        request.experiment_id,
        request.response_name,
        request.model,
        factor_x=request.factor_x,
        factor_y=request.factor_y,
        block_name=request.block_name,
        block_labels=request.block_labels,
    )
    read = _to_read(result)
    return _sanitize(read.model_dump(mode="json"))


async def profiler(bundle: dict, req: dict) -> dict:
    request = ProfilerRequest.model_validate(req)
    service = AnalysisService(InMemoryRepo(bundle))
    result = await service.profiler(
        request.experiment_id,
        request.response_name,
        request.model,
        point=request.point,
        maximize=request.maximize,
    )
    read = _profiler_to_read(result)
    return _sanitize(read.model_dump(mode="json"))


async def export_plot(
    bundle: dict,
    experiment_id: int,
    response_name: str,
    model: str,
    plot: str,
    fmt: str,
    dpi: int = 600,
    factor_x: str | None = None,
    factor_y: str | None = None,
) -> dict:
    # Lazy import: matplotlib/scienceplots only arrive at boot stage 2 in the
    # browser; the analysis core must not depend on them.
    from services.publication_service import PublicationService

    service = PublicationService(InMemoryRepo(bundle))
    content, media_type, filename = await service.export_plot(
        experiment_id,
        response_name,
        RSMModel(model),
        plot,
        fmt,
        dpi=dpi,
        factor_x=factor_x,
        factor_y=factor_y,
    )
    return {
        "content_b64": base64.b64encode(content).decode("ascii"),
        "media_type": media_type,
        "filename": filename,
    }


async def export_plot_report(
    bundle: dict,
    experiment_id: int,
    response_name: str,
    model: str,
    plot: str,
    factor_x: str | None = None,
    factor_y: str | None = None,
) -> dict | None:
    """Report variant: returns None when the fitted model does not produce the
    requested figure (mirrors the old 422-skip behaviour of /export/plot)."""
    from domain.errors import InsufficientDataError
    from services.publication_service import PublicationExportError

    try:
        return await export_plot(
            bundle,
            experiment_id,
            response_name,
            model,
            plot,
            "png",
            dpi=600,
            factor_x=factor_x,
            factor_y=factor_y,
        )
    except (InsufficientDataError, PublicationExportError):
        return None


def retro_diagnose(req: dict) -> dict:
    request = RetroDiagnoseRequest.model_validate(req)
    result = retrospective_analysis.diagnose(request)
    payload = RetroDiagnoseResponse.model_validate(_sanitize(result.model_dump()))
    return payload.model_dump(mode="json")


# --- fronteira única JSON (chamada pelo worker) --------------------------------


async def call_json(op: str, args_json: str) -> str:
    """Única fronteira JS<->Python: strings JSON dos dois lados.

    Evita toda a classe de bugs de conversão JsProxy/JsNull: o worker manda
    JSON.stringify(args) e recebe uma string JSON de volta.
    """
    import json

    args = json.loads(args_json)

    if op == "taguchi_catalog":
        out = taguchi_catalog()
    elif op == "generate_design":
        out = generate_design(args["req"])
    elif op == "analyze":
        out = await analyze(args["bundle"], args["req"])
    elif op == "profiler":
        out = await profiler(args["bundle"], args["req"])
    elif op == "export_plot":
        out = await export_plot(
            args["bundle"],
            args["experiment_id"],
            args["response_name"],
            args["model"],
            args["plot"],
            args["fmt"],
            args.get("dpi") or 600,
            args.get("factor_x"),
            args.get("factor_y"),
        )
    elif op == "export_plot_report":
        out = await export_plot_report(
            args["bundle"],
            args["experiment_id"],
            args["response_name"],
            args["model"],
            args["plot"],
            args.get("factor_x"),
            args.get("factor_y"),
        )
    elif op == "advise":
        from services.advisor_service import advise as _advise

        out = _sanitize(_advise(args["result"], args["design_meta"]))
    elif op == "augment_design":
        from services.design_augment import augment_design as _augment

        out = _sanitize(_augment(args["design"], args["option"]))
    elif op == "retro_diagnose":
        out = retro_diagnose(args["req"])
    elif op == "retro_materialize":
        out = retro_materialize(args["req"])
    else:
        raise ValueError(f"Operação desconhecida: {op}")

    return json.dumps(out)


def retro_materialize(req: dict) -> dict:
    """Pure part of materialize: build the design; TS persists and assigns ids."""
    request = RetroMaterializeRequest.model_validate(req)
    design, excluded, warnings = _build_retrospective_design(request)
    read = _to_design_read(0, design, PersistedDesign(experiment_id=0, design_type=design.design_type))
    return _sanitize(
        {
            "design": read.model_dump(mode="json"),
            "design_type": design.design_type,
            "n_runs": len(design.runs),
            "excluded_constant_factors": excluded,
            "warnings": warnings,
            "name": request.name.strip(),
            "description": request.description,
        }
    )

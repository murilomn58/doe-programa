"""Browser-engine stand-in for the SQLAlchemy ORM models.

Plain dataclasses with the SAME attribute names the services read. In the
browser there is no database: the TypeScript layer (IndexedDB) hydrates these
objects through ``engine_api.InMemoryRepo``. Keep field names in sync with
``backend/domain/models.py``.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class Level:
    coded_value: int
    natural_value: float | None = None
    label: str | None = None
    id: int | None = None
    factor_id: int | None = None


@dataclass
class Factor:
    name: str
    factor_type: str
    position: int
    unit: str | None = None
    id: int | None = None
    experiment_id: int | None = None
    levels: list[Level] = field(default_factory=list)


@dataclass
class Response:
    name: str
    position: int
    unit: str | None = None
    id: int | None = None
    experiment_id: int | None = None


@dataclass
class Run:
    run_order: int
    std_order: int
    point_type: int
    block: int
    replicate: int
    cells: dict = field(default_factory=dict)
    response_values: dict = field(default_factory=dict)
    id: int | None = None
    experiment_id: int | None = None


@dataclass
class Experiment:
    name: str
    description: str | None = None
    id: int | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    factors: list[Factor] = field(default_factory=list)
    responses: list[Response] = field(default_factory=list)
    runs: list[Run] = field(default_factory=list)

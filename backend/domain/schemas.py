"""Pydantic request/response schemas (the HTTP contract)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ExperimentCreate(BaseModel):
    """POST /experiments body."""

    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class ExperimentRead(BaseModel):
    """Experiment as returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    created_at: datetime

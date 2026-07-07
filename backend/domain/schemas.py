"""Pydantic request/response schemas (the HTTP contract)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from domain.types import DesignType, FactorType


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


# --- Design generation (issue 02) --------------------------------------------


class FactorSpec(BaseModel):
    """A factor as described by the user in the setup wizard."""

    name: str = Field(min_length=1, max_length=255)
    factor_type: FactorType
    unit: str | None = Field(default=None, max_length=50)
    # quantitative: numeric endpoints
    low: float | None = None
    high: float | None = None
    # qualitative: category labels
    low_label: str | None = Field(default=None, max_length=255)
    high_label: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def _check_levels(self) -> "FactorSpec":
        if self.factor_type is FactorType.QUANTITATIVE:
            if self.low is None or self.high is None:
                raise ValueError(
                    f"Fator quantitativo '{self.name}' precisa de valores baixo e alto."
                )
            if self.low == self.high:
                raise ValueError(
                    f"Fator quantitativo '{self.name}': baixo e alto não podem ser iguais."
                )
        else:
            if not self.low_label or not self.high_label:
                raise ValueError(
                    f"Fator qualitativo '{self.name}' precisa de rótulos baixo e alto."
                )
        return self


class ResponseSpec(BaseModel):
    """A response (output) column to be measured."""

    name: str = Field(min_length=1, max_length=255)
    unit: str | None = Field(default=None, max_length=50)


class DesignGenerateRequest(BaseModel):
    """POST /designs/generate body."""

    name: str | None = Field(default=None, max_length=255)
    experiment_id: int | None = None
    design_type: DesignType = DesignType.FULL_FACTORIAL_2K
    replicates: int = Field(default=1, ge=1, le=20)
    factors: list[FactorSpec] = Field(min_length=1)
    responses: list[ResponseSpec] = Field(default_factory=list)
    seed: int | None = None  # optional: deterministic run-order randomization


class LevelRead(BaseModel):
    coded_value: int
    natural_value: float | None = None
    label: str | None = None


class FactorRead(BaseModel):
    id: int | None = None
    name: str
    factor_type: FactorType
    unit: str | None = None
    position: int
    levels: list[LevelRead]


class ResponseRead(BaseModel):
    id: int | None = None
    name: str
    unit: str | None = None
    position: int


class RunCellRead(BaseModel):
    coded: int
    natural: float | None = None
    label: str | None = None


class RunRead(BaseModel):
    run_order: int
    std_order: int
    point_type: int
    block: int
    replicate: int
    factors: dict[str, RunCellRead]


class DesignRead(BaseModel):
    """The generated matrix returned to the frontend RunsTable (read-only)."""

    experiment_id: int
    design_type: DesignType
    n_runs: int
    factors: list[FactorRead]
    responses: list[ResponseRead]
    runs: list[RunRead]

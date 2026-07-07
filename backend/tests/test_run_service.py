"""Unit tests for the response-entry seam (RunService + pure value parsing).

The service is exercised through a FakeRunRepo implementing the ``RunRepository``
Protocol (never against internals), covering the issue-03 behaviour: partial
save round-trip, bulk upsert of multiple responses per run, and rejection of a
non-numeric value at the service boundary.
"""

import pytest

from domain.errors import ResponseValueError
from domain.models import Experiment, Factor, Level, Response, Run
from domain.schemas import ResponsesUpsertRequest, ResponseValueUpsert
from services.run_service import RunService, parse_response_value

# --- pure value parsing (validation seam) ------------------------------------


def test_parse_numeric_string():
    assert parse_response_value("1.5") == pytest.approx(1.5)
    assert parse_response_value(" 42 ") == pytest.approx(42.0)


def test_parse_accepts_ptbr_decimal_comma():
    assert parse_response_value("3,25") == pytest.approx(3.25)


def test_parse_empty_is_none():
    assert parse_response_value("") is None
    assert parse_response_value("   ") is None
    assert parse_response_value(None) is None


def test_parse_non_numeric_raises():
    with pytest.raises(ResponseValueError):
        parse_response_value("abc")
    with pytest.raises(ResponseValueError):
        parse_response_value("1.2.3")


# --- FakeRepo implementing the RunRepository Protocol ------------------------


class FakeRunRepo:
    """In-memory stand-in with a small persisted 2^2 design (1 exp)."""

    def __init__(self) -> None:
        self.experiment = Experiment(id=1, name="exp")
        self.factors = [
            Factor(id=1, experiment_id=1, name="A", factor_type="quantitative",
                   unit="%", position=0),
            Factor(id=2, experiment_id=1, name="B", factor_type="quantitative",
                   unit="%", position=1),
        ]
        self.factors[0].levels = [
            Level(id=1, factor_id=1, coded_value=-1, natural_value=0.0),
            Level(id=2, factor_id=1, coded_value=1, natural_value=1.5),
        ]
        self.factors[1].levels = [
            Level(id=3, factor_id=2, coded_value=-1, natural_value=10.0),
            Level(id=4, factor_id=2, coded_value=1, natural_value=20.0),
        ]
        self.responses = [
            Response(id=1, experiment_id=1, name="MR", unit="MPa", position=0),
            Response(id=2, experiment_id=1, name="DP", unit="mm", position=1),
        ]
        self.runs = [
            Run(id=100 + i, experiment_id=1, run_order=i + 1, std_order=i + 1,
                point_type=1, block=1, replicate=1,
                cells={"A": {"coded": 1, "natural": 1.5, "label": None},
                       "B": {"coded": -1, "natural": 10.0, "label": None}},
                response_values={})
            for i in range(4)
        ]

    async def get_experiment(self, experiment_id: int):
        return self.experiment if experiment_id == 1 else None

    async def get_factors(self, experiment_id: int):
        return list(self.factors) if experiment_id == 1 else []

    async def get_responses(self, experiment_id: int):
        return list(self.responses) if experiment_id == 1 else []

    async def get_runs(self, experiment_id: int):
        return list(self.runs) if experiment_id == 1 else []

    async def upsert_response_values(self, experiment_id, values):
        by_id = {r.id: r for r in self.runs}
        for run_id, vals in values.items():
            run = by_id[run_id]
            run.response_values = {**run.response_values, **vals}


# --- read path ---------------------------------------------------------------


async def test_get_runs_returns_matrix_and_empty_responses():
    service = RunService(FakeRunRepo())
    result = await service.get_runs(1)
    assert result.experiment_id == 1
    assert result.n_runs == 4
    assert [f.name for f in result.factors] == ["A", "B"]
    assert [r.name for r in result.responses] == ["MR", "DP"]
    # runs carry their id and start with empty response values
    assert all(run.id is not None for run in result.runs)
    assert all(run.response_values == {} for run in result.runs)


# --- partial save round-trip (CA: salvamento parcial persiste) ---------------


async def test_partial_save_persists_and_round_trips():
    repo = FakeRunRepo()
    service = RunService(repo)
    run_id = repo.runs[0].id
    req = ResponsesUpsertRequest(
        values=[ResponseValueUpsert(run_id=run_id, response_name="MR", value="12.5")]
    )
    await service.save_responses(1, req)

    fresh = await service.get_runs(1)
    target = next(r for r in fresh.runs if r.id == run_id)
    assert target.response_values["MR"] == pytest.approx(12.5)
    # other runs remain empty (partial)
    others = [r for r in fresh.runs if r.id != run_id]
    assert all(r.response_values == {} for r in others)


# --- bulk upsert of multiple responses per run -------------------------------


async def test_bulk_upsert_multiple_responses_per_run():
    repo = FakeRunRepo()
    service = RunService(repo)
    r0, r1 = repo.runs[0].id, repo.runs[1].id
    req = ResponsesUpsertRequest(
        values=[
            ResponseValueUpsert(run_id=r0, response_name="MR", value="1"),
            ResponseValueUpsert(run_id=r0, response_name="DP", value="2,5"),
            ResponseValueUpsert(run_id=r1, response_name="MR", value="3"),
        ]
    )
    result = await service.save_responses(1, req)
    got = {r.id: r.response_values for r in result.runs}
    assert got[r0]["MR"] == pytest.approx(1.0)
    assert got[r0]["DP"] == pytest.approx(2.5)
    assert got[r1]["MR"] == pytest.approx(3.0)
    assert "DP" not in got[r1]


# --- empty value clears / stays partial --------------------------------------


async def test_empty_value_stored_as_none():
    repo = FakeRunRepo()
    service = RunService(repo)
    run_id = repo.runs[0].id
    req = ResponsesUpsertRequest(
        values=[ResponseValueUpsert(run_id=run_id, response_name="MR", value="")]
    )
    result = await service.save_responses(1, req)
    target = next(r for r in result.runs if r.id == run_id)
    assert target.response_values["MR"] is None


# --- validation: non-numeric rejected at the service -------------------------


async def test_non_numeric_value_rejected_by_service():
    repo = FakeRunRepo()
    service = RunService(repo)
    req = ResponsesUpsertRequest(
        values=[ResponseValueUpsert(run_id=repo.runs[0].id,
                                    response_name="MR", value="abc")]
    )
    with pytest.raises(ResponseValueError):
        await service.save_responses(1, req)
    # nothing persisted on rejection
    fresh = await service.get_runs(1)
    assert all(r.response_values == {} for r in fresh.runs)


async def test_unknown_response_name_rejected():
    repo = FakeRunRepo()
    service = RunService(repo)
    req = ResponsesUpsertRequest(
        values=[ResponseValueUpsert(run_id=repo.runs[0].id,
                                    response_name="XYZ", value="1")]
    )
    with pytest.raises(ResponseValueError):
        await service.save_responses(1, req)


async def test_unknown_run_id_rejected():
    repo = FakeRunRepo()
    service = RunService(repo)
    req = ResponsesUpsertRequest(
        values=[ResponseValueUpsert(run_id=999, response_name="MR", value="1")]
    )
    with pytest.raises(ResponseValueError):
        await service.save_responses(1, req)

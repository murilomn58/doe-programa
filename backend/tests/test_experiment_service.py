"""TDD at the service seam (the repository port).

Uses an in-memory FakeRepo implementing the ``ExperimentRepository`` Protocol,
so the service is tested against its port, not against SQLAlchemy internals.
"""

from datetime import UTC, datetime

from domain.models import Experiment
from domain.schemas import ExperimentCreate
from services.experiment_service import ExperimentService


class FakeExperimentRepo:
    """In-memory implementation of the ExperimentRepository port."""

    def __init__(self) -> None:
        self._items: list[Experiment] = []
        self._next_id = 1

    async def add(self, name: str, description: str | None) -> Experiment:
        experiment = Experiment(
            id=self._next_id,
            name=name,
            description=description,
            created_at=datetime.now(UTC),
        )
        self._items.append(experiment)
        self._next_id += 1
        return experiment

    async def list_all(self) -> list[Experiment]:
        return list(self._items)


async def test_create_experiment_persists_and_returns_domain() -> None:
    service = ExperimentService(FakeExperimentRepo())

    experiment = await service.create_experiment(
        ExperimentCreate(name="Fibra de coco", description="triagem inicial")
    )

    assert experiment.id == 1
    assert experiment.name == "Fibra de coco"
    assert experiment.description == "triagem inicial"


async def test_list_experiments_returns_all_in_order() -> None:
    service = ExperimentService(FakeExperimentRepo())
    await service.create_experiment(ExperimentCreate(name="A", description=None))
    await service.create_experiment(ExperimentCreate(name="B", description="com desc"))

    experiments = await service.list_experiments()

    assert len(experiments) == 2
    assert [e.name for e in experiments] == ["A", "B"]

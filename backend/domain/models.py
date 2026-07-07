"""SQLAlchemy ORM models = the persistence-facing domain entities.

Issue 01 scaffold: ``Experiment``. Issue 02 adds the DoE entities used by the
2^k generator: ``Factor`` (+ its ``Level`` map), ``Response`` and ``Run``.

Enums are stored as plain strings so the schema stays simple and portable
across SQLite/PostgreSQL; the ``FactorType``/``DesignType`` enums live in the
Pydantic/service layers for validation.
"""

from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Declarative base shared by all models and by Alembic autogenerate."""


class Experiment(Base):
    __tablename__ = "experiments"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    factors: Mapped[list["Factor"]] = relationship(
        back_populates="experiment", cascade="all, delete-orphan"
    )
    responses: Mapped[list["Response"]] = relationship(
        back_populates="experiment", cascade="all, delete-orphan"
    )
    runs: Mapped[list["Run"]] = relationship(
        back_populates="experiment", cascade="all, delete-orphan"
    )


class Factor(Base):
    __tablename__ = "factors"

    id: Mapped[int] = mapped_column(primary_key=True)
    experiment_id: Mapped[int] = mapped_column(
        ForeignKey("experiments.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    factor_type: Mapped[str] = mapped_column(String(20), nullable=False)
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)

    experiment: Mapped["Experiment"] = relationship(back_populates="factors")
    levels: Mapped[list["Level"]] = relationship(
        back_populates="factor", cascade="all, delete-orphan"
    )


class Level(Base):
    """The persisted ±1 map of a factor (e.g. -1->'Tucum', +1->'Piassava')."""

    __tablename__ = "levels"

    id: Mapped[int] = mapped_column(primary_key=True)
    factor_id: Mapped[int] = mapped_column(
        ForeignKey("factors.id"), nullable=False, index=True
    )
    coded_value: Mapped[int] = mapped_column(Integer, nullable=False)  # -1 / +1
    natural_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    label: Mapped[str | None] = mapped_column(String(255), nullable=True)

    factor: Mapped["Factor"] = relationship(back_populates="levels")


class Response(Base):
    __tablename__ = "responses"

    id: Mapped[int] = mapped_column(primary_key=True)
    experiment_id: Mapped[int] = mapped_column(
        ForeignKey("experiments.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)

    experiment: Mapped["Experiment"] = relationship(back_populates="responses")


class Run(Base):
    """One row of the generated matrix (OriginPro-style columns).

    The coded/natural/label value of each factor is stored as JSON keyed by
    factor name (``cells``), keeping the row self-describing for the frontend.
    """

    __tablename__ = "runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    experiment_id: Mapped[int] = mapped_column(
        ForeignKey("experiments.id"), nullable=False, index=True
    )
    run_order: Mapped[int] = mapped_column(Integer, nullable=False)
    std_order: Mapped[int] = mapped_column(Integer, nullable=False)
    point_type: Mapped[int] = mapped_column(Integer, nullable=False)
    block: Mapped[int] = mapped_column(Integer, nullable=False)
    replicate: Mapped[int] = mapped_column(Integer, nullable=False)
    cells: Mapped[dict] = mapped_column(JSON, nullable=False)

    experiment: Mapped["Experiment"] = relationship(back_populates="runs")

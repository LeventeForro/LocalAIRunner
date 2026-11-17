import uuid
from datetime import datetime
from typing import List, Optional
from decimal import Decimal
from sqlalchemy import String, BigInteger, Numeric, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class ModelSchema(Base):
    __tablename__ = "models"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    family: Mapped[Optional[str]] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    test_runs: Mapped[List["TestRunSchema"]] = relationship(back_populates="model", cascade="all, delete-orphan")


class TestRunSchema(Base):
    __tablename__ = "test_runs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    model_id: Mapped[int] = mapped_column(ForeignKey("models.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(255)) # ÚJ: Beszélgetés címe
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    response: Mapped[Optional[str]] = mapped_column(Text)
    temperature: Mapped[Optional[Decimal]] = mapped_column(Numeric(3, 2))
    max_tokens: Mapped[Optional[int]] = mapped_column()
    context_window: Mapped[Optional[int]] = mapped_column()
    ttft_ms: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    tps: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2))
    latency_ms: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    model: Mapped["ModelSchema"] = relationship(back_populates="test_runs")
    telemetry_logs: Mapped[List["TelemetryLogSchema"]] = relationship(back_populates="test_run", cascade="all, delete-orphan")


class TelemetryLogSchema(Base):
    __tablename__ = "telemetry_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    test_run_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("test_runs.id", ondelete="SET NULL"))
    cpu_usage_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    ram_usage_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    gpu_utilization_pct: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    vram_usage_bytes: Mapped[Optional[int]] = mapped_column(BigInteger)
    gpu_temp_celsius: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 1))
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    test_run: Mapped[Optional["TestRunSchema"]] = relationship(back_populates="telemetry_logs")

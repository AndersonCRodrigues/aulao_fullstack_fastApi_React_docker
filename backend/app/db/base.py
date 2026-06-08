import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Uuid
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    """Base declarativa do SQLAlchemy 2.0."""

    __abstract__ = True

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now_utc
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now_utc, onupdate=_now_utc
    )

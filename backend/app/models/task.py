import uuid

from sqlalchemy import Boolean, ForeignKey, LargeBinary
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Task(Base):
    """Modelo ORM para a tabela de tasks."""

    __tablename__ = "tasks"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Armazena bytes (nonce + ciphertext + tag)
    title_enc: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    content_enc: Mapped[bytes | None] = mapped_column(
        LargeBinary,
        nullable=True,
    )

    # Novo campo booleano
    completed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Relacionamento N:1 com User
    owner = relationship("User", back_populates="tasks")

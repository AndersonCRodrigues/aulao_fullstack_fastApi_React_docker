from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    """Modelo ORM para a tabela de usuários."""

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    # Relacionamento 1:N com Tasks
    tasks = relationship(
        "Task",
        back_populates="owner",
        cascade="all, delete-orphan",
    )

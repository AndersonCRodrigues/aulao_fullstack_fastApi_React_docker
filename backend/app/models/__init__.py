# Importações necessárias para que o Alembic descubra as tabelas
from app.db.base import Base
from .task import Task
from .user import User

__all__ = ["Base", "User", "Task"]

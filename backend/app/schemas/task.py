import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, model_validator

from app.core.encryption import decrypt, decrypt_optional


class TaskCreate(BaseModel):
    title: str
    content: str | None = None


class TaskUpdate(BaseModel):
    content: str | None = None
    completed: bool | None = None


class TaskOut(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    title: str
    content: str | None = None
    completed: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def decrypt_fields(cls, data: Any) -> Any:
        """
        Descriptografa os campos cifrados para a resposta da API.
        """
        if hasattr(data, "title_enc"):
            title_decrypted = decrypt(data.title_enc)
            content_decrypted = decrypt_optional(data.content_enc)

            return {
                "id": data.id,
                "owner_id": data.owner_id,
                "title": title_decrypted,
                "content": content_decrypted,
                "completed": data.completed,
                "created_at": data.created_at,
                "updated_at": data.updated_at,
            }
        return data

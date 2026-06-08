from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Carrega as variáveis de ambiente usando pydantic-settings.
    """

    APP_NAME: str = "FastAPI Secure Backend"
    DEBUG: bool = False

    # Banco de Dados
    DATABASE_URL: str

    # JWT
    JWT_ACCESS_SECRET: str
    JWT_REFRESH_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_EXPIRE_DAYS: int = 7

    # Criptografia AES
    TASK_ENCRYPTION_KEY_HEX: str

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )


settings = Settings()

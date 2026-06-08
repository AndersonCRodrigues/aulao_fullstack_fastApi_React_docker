from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import settings

# Cria a engine assíncrona
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True,
    pool_pre_ping=True,  # Reconecta caso a conexão caia
)

# Fábrica de sessões assíncronas
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)

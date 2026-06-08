"""
api/deps.py
===========
Dependências reutilizáveis injetadas via `Depends()` nas rotas do FastAPI.

O sistema de Dependency Injection do FastAPI é poderoso:
- Evita repetição de código (DRY) para autenticação e DB.
- Facilita testes: basta substituir a dependência no override.
- Garante que a sessão DB é fechada ao fim de cada request (via generator).

Dependências definidas aqui:
    get_db            → Gera e fecha uma sessão AsyncSession por request.
    get_current_user  → Extrai e valida o JWT do header; retorna o User do DB.
"""

from typing import AsyncGenerator

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.session import AsyncSessionLocal
from app.models.user import User

# ─── Extrator de Bearer Token ──────────────────────────────────────────────────
# HTTPBearer lê o header `Authorization: Bearer <token>` automaticamente.
# auto_error=True → retorna 403 automaticamente se o header estiver ausente.
_bearer_scheme = HTTPBearer(auto_error=True)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependência de sessão de banco de dados.

    Cria uma nova AsyncSession para cada request e garante que ela é
    fechada ao final — mesmo se ocorrer uma exceção (via try/finally).

    Uso em rotas:
        @router.get("/exemplo")
        async def minha_rota(db: AsyncSession = Depends(get_db)):
            result = await db.execute(select(User))

    Por que generator (yield)?
        O FastAPI executa o código antes do yield para setup,
        e o código após o yield para teardown (cleanup).
        Isso é equivalente a um context manager.

    Yields:
        AsyncSession: Sessão ativa do banco.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            # Se a rota concluiu sem erro, commit implícito já ocorreu
            # (as rotas fazem await db.commit() explicitamente)
        except Exception:
            # Qualquer erro na rota → rollback para não deixar transação suja
            await session.rollback()
            raise
        # finally: a sessão é fechada pelo context manager `async with`


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Dependência de autenticação — o guardião de todas as rotas protegidas.

    Fluxo:
        1. HTTPBearer extrai o token do header Authorization.
        2. decode_access_token valida assinatura, expiração e type claim.
        3. Busca o usuário no banco pelo UUID do claim `sub`.
        4. Verifica se o usuário está ativo (is_active=True).
        5. Retorna o objeto User — disponível na rota como parâmetro.

    Se qualquer etapa falhar → HTTP 401 Unauthorized.

    Security note:
        Usamos a mesma mensagem genérica ("Credenciais inválidas") para TODOS
        os erros de auth. Isso evita que um atacante descubra se o token é
        inválido vs expirado vs usuário inexistente (information leakage).

    Args:
        credentials: Token extraído do header pelo HTTPBearer.
        db:          Sessão do banco injetada.

    Returns:
        User: Objeto ORM do usuário autenticado.

    Raises:
        HTTPException 401: Em qualquer falha de autenticação.
    """
    # Mensagem genérica — não revela o motivo específico da falha
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais inválidas ou expiradas.",
        headers={"WWW-Authenticate": "Bearer"},
        # WWW-Authenticate: padrão RFC 6750 para APIs com Bearer tokens
    )

    try:
        # Valida o token (assinatura + expiração + type claim)
        payload = decode_access_token(credentials.credentials)
        user_id: str | None = payload.get("sub")

        if user_id is None:
            # Token válido mas sem `sub` — nunca deveria ocorrer com nossa geração
            raise credentials_exception

    except jwt.ExpiredSignatureError:
        # Token expirou — cliente deve usar o refresh token
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado. Use o refresh token para renovar.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        # Assinatura inválida, formato errado, type incorreto, etc.
        raise credentials_exception

    # Busca o usuário no banco para confirmar que ainda existe
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        # Usuário foi deletado mas o token ainda está válido
        raise credentials_exception

    if not user.is_active:
        # Conta desativada — bloqueia mesmo com token válido
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conta desativada. Entre em contato com o suporte.",
        )

    return user

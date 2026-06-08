"""
app/core/security.py
====================
Hash/verify de senhas com Argon2id e geração/decodificação de JWTs.

Por que Argon2id?
    Vencedor do Password Hashing Competition (2015).
    Memory-hard: resistente a ataques GPU/ASIC.
    Argon2id = híbrido de Argon2i (side-channel) + Argon2d (GPU resistance).
    Recomendado pelo OWASP 2024 como primeira opção.

Por que secrets separados para access e refresh?
    Vazamento do access secret não compromete o refresh (mais crítico).
    O refresh permite emitir novos access tokens — separação de responsabilidades.

Claim `type` no payload:
    Impede que refresh token seja aceito como access token e vice-versa.
    Sem esse claim, um atacante com refresh token poderia autenticar rotas protegidas.
"""

import uuid
from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

from app.config import settings

# ── Hash de senha ─────────────────────────────────────────────────────────────
_hasher = PasswordHash(hashers=[Argon2Hasher()])


def hash_password(plain: str) -> str:
    """
    Gera hash Argon2id da senha.
    O hash PHC inclui: algoritmo + parâmetros + salt aleatório + digest.
    Exemplo: $argon2id$v=19$m=65536,t=3,p=4$<salt_b64>$<hash_b64>
    """
    return _hasher.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """
    Verifica senha contra hash em tempo constante.
    Retorna False para qualquer exceção — nunca propaga detalhes internos.
    """
    try:
        return _hasher.verify(plain, hashed)
    except Exception:
        return False


# ── JWT internals ─────────────────────────────────────────────────────────────


def _create_token(
    subject: str,
    token_type: str,
    secret: str,
    expires_delta: timedelta,
) -> str:
    """
    Fábrica interna de JWTs assinados com HMAC-SHA256.

    Claims gerados:
        sub  — identificador do usuário (UUID str)
        type — "access" | "refresh"  (barreira anti-confusão)
        iat  — issued at (UTC)
        exp  — expiration (UTC)
        jti  — UUID único por token (base para futura revogação via denylist)
    """
    now = datetime.now(UTC)
    payload = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, secret, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: uuid.UUID) -> str:
    """Access token de curta duração (padrão: 15 min)."""
    return _create_token(
        subject=str(user_id),
        token_type="access",
        secret=settings.JWT_ACCESS_SECRET,
        expires_delta=timedelta(minutes=settings.JWT_ACCESS_EXPIRE_MINUTES),
    )


def create_refresh_token(user_id: uuid.UUID) -> str:
    """Refresh token de longa duração (padrão: 7 dias)."""
    return _create_token(
        subject=str(user_id),
        token_type="refresh",
        secret=settings.JWT_REFRESH_SECRET,
        expires_delta=timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS),
    )


def decode_access_token(token: str) -> dict:
    """
    Valida e decodifica access token.

    PyJWT valida automaticamente: assinatura HMAC, expiração (exp).
    Nós validamos adicionalmente: type == "access".

    Raises:
        jwt.ExpiredSignatureError — token expirado
        jwt.InvalidTokenError     — assinatura inválida, type errado, etc.
    """
    payload = jwt.decode(
        token,
        settings.JWT_ACCESS_SECRET,
        algorithms=[settings.JWT_ALGORITHM],
        options={"require": ["exp", "sub", "type"]},
    )
    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("type claim inválido para access token.")
    return payload


def decode_refresh_token(token: str) -> dict:
    """
    Valida e decodifica refresh token.

    Raises:
        jwt.ExpiredSignatureError — refresh expirado → usuário precisa re-logar
        jwt.InvalidTokenError     — token inválido ou type errado
    """
    payload = jwt.decode(
        token,
        settings.JWT_REFRESH_SECRET,
        algorithms=[settings.JWT_ALGORITHM],
        options={"require": ["exp", "sub", "type"]},
    )
    if payload.get("type") != "refresh":
        raise jwt.InvalidTokenError("type claim inválido para refresh token.")
    return payload

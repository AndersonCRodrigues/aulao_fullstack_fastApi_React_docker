"""
api/v1/auth.py
==============
Rotas públicas de autenticação:
    POST /auth/register  → cadastro de novo usuário
    POST /auth/login     → login com email+senha, retorna par de tokens
    POST /auth/refresh   → troca refresh token por novo access token

Todas as rotas aqui são PÚBLICAS (sem Depends(get_current_user)).

Boas práticas de segurança implementadas:
- Senha nunca é logada nem retornada.
- Erro de login sempre retorna 401 genérico (não revela se email existe).
- verify_password usa tempo constante (Argon2 internamente).
- Refresh token validado com secret separado e type claim "refresh".
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas.user import (
    LoginRequest,
    RefreshRequest,
    TokenPair,
    UserCreate,
    UserOut,
)

router = APIRouter(prefix="/auth", tags=["Autenticação"])


@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastro de novo usuário",
    description=(
        "Cria um novo usuário com email único. "
        "A senha é hasheada com Argon2id antes de armazenar. "
        "Retorna os dados públicos do usuário (sem senha)."
    ),
)
async def register(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    """
    Cadastra um novo usuário na plataforma.

    Processo:
        1. Verifica se o email já está em uso.
        2. Gera o hash Argon2id da senha.
        3. Cria o registro no banco.
        4. Retorna UserOut (dados públicos).

    Args:
        body: UserCreate com email e password validados pelo Pydantic.
        db:   Sessão do banco injetada por get_db.

    Returns:
        UserOut: Dados públicos do usuário criado (HTTP 201).

    Raises:
        HTTPException 409: Email já cadastrado.
    """
    # 1. Verifica duplicidade de email
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este e-mail já está cadastrado.",
        )

    # 2. Hash da senha — NUNCA armazena body.password diretamente
    hashed = hash_password(body.password)

    # 3. Cria o objeto ORM e persiste
    user = User(email=body.email, hashed_password=hashed)
    db.add(user)
    await db.commit()
    # refresh carrega os valores gerados pelo banco (id, created_at, updated_at)
    await db.refresh(user)

    # 4. Serializa para UserOut (exclui hashed_password automaticamente)
    return UserOut.model_validate(user)


@router.post(
    "/login",
    response_model=TokenPair,
    summary="Login e obtenção de tokens",
    description=(
        "Autentica com email e senha. "
        "Retorna access token (15 min) e refresh token (7 dias). "
        "Erros de credencial sempre retornam 401 genérico para evitar enumeração."
    ),
)
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenPair:
    """
    Autentica o usuário e retorna um par de tokens JWT.

    Processo:
        1. Busca usuário pelo email.
        2. Verifica a senha com Argon2id (tempo constante).
        3. Gera access token (15 min) e refresh token (7 dias).
        4. Retorna TokenPair.

    Security:
        Passos 1 e 2 retornam o mesmo erro 401 genérico se falharem.
        Isso previne user enumeration attack — o atacante não sabe
        se o email existe ou se a senha está errada.

    Args:
        body: LoginRequest com email e password.
        db:   Sessão do banco.

    Returns:
        TokenPair: access_token, refresh_token, token_type.

    Raises:
        HTTPException 401: Credenciais inválidas (email não existe ou senha errada).
        HTTPException 403: Conta desativada.
    """
    # Mensagem única para qualquer falha de autenticação
    invalid_credentials = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="E-mail ou senha inválidos.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # 1. Busca por email
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    # 2. Verifica existência + senha (não revela qual falhou)
    if user is None or not verify_password(body.password, user.hashed_password):
        raise invalid_credentials

    # Conta ativa?
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conta desativada.",
        )

    # 3. Gera tokens com secrets separados
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    return TokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post(
    "/refresh",
    response_model=TokenPair,
    summary="Renovar tokens via refresh token",
    description=(
        "Recebe um refresh token válido e retorna um NOVO par de tokens. "
        "Use quando o access token expirar. "
        "O refresh token antigo continua válido até sua expiração natural (7 dias)."
    ),
)
async def refresh_tokens(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenPair:
    """
    Renova o par de tokens usando um refresh token válido.

    Fluxo típico do cliente:
        1. Access token expira → API retorna 401.
        2. Cliente chama POST /auth/refresh com o refresh token.
        3. Recebe novos access + refresh tokens.
        4. Continua usando a API com o novo access token.

    Nota sobre rotação de refresh tokens:
        Esta implementação NÃO invalida o refresh token antigo (stateless).
        Para invalidação, seria necessário um denylist em Redis.
        Isso é um trade-off: simplicidade vs segurança máxima.
        Para produção crítica, implemente token rotation com Redis.

    Args:
        body: RefreshRequest com o refresh_token.
        db:   Sessão do banco para verificar se o usuário ainda existe.

    Returns:
        TokenPair: Novo par de tokens.

    Raises:
        HTTPException 401: Refresh token inválido, expirado ou usuário inexistente.
    """
    invalid_token = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Refresh token inválido ou expirado.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # Valida assinatura + expiração + type == "refresh"
        payload = decode_refresh_token(body.refresh_token)
        user_id: str | None = payload.get("sub")

        if user_id is None:
            raise invalid_token

    except Exception:
        # jwt.ExpiredSignatureError, jwt.InvalidTokenError, etc.
        raise invalid_token

    # Confirma que o usuário ainda existe e está ativo
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise invalid_token

    # Emite novos tokens
    new_access = create_access_token(user.id)
    new_refresh = create_refresh_token(user.id)

    return TokenPair(
        access_token=new_access,
        refresh_token=new_refresh,
    )

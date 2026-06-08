"""
api/v1/tasks.py
===============
CRUD de tasks — todas as rotas são PROTEGIDAS por JWT.

Controle de acesso (Authorization):
    Autenticação (quem você é) → resolvida por get_current_user via JWT.
    Autorização (o que pode fazer) → verificada em cada rota:
        task.owner_id == current_user.id

    Se um usuário tentar acessar a task de outro, recebe HTTP 404
    (não 403!) — isso evita revelar a existência do recurso (IDOR prevention).
    "Você não tem permissão" já confirma que o recurso existe.
    "Não encontrado" não confirma nada.

Criptografia e Busca:
    Entrada (create/update): texto claro → encrypt() → bytes no banco.
    Saída (get/list):        bytes do banco → TaskOut.decrypt_fields() → texto claro.
    Busca Textual (q):       Como os dados estão cifrados (AES-256-GCM), o banco (Postgres)
                             enxerga apenas bytes aleatórios. Portanto, buscas textuais (ILIKE)
                             no SQL não funcionam. A busca é feita descriptografando
                             os registros em memória (na API) e filtrando via Python.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.encryption import encrypt, encrypt_optional
from app.models.task import Task
from app.models.user import User
from app.schemas.task import TaskCreate, TaskOut, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.post(
    "/",
    response_model=TaskOut,
    status_code=status.HTTP_201_CREATED,
    summary="Criar nova task",
    description=(
        "Cria uma task para o usuário autenticado. "
        "O título e o conteúdo são criptografados com AES-256-GCM antes de salvar. "
        "O status 'completed' inicia automaticamente como False."
    ),
)
async def create_task(
    body: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskOut:
    """
    Cria uma nova task associada ao usuário autenticado.

    Processo:
        1. Criptografa title (obrigatório) e content (opcional).
        2. Cria o registro Task com owner_id = current_user.id (completed=False no DB).
        3. Persiste e retorna TaskOut (com descriptografia automática do schema).

    Args:
        body:         TaskCreate contendo 'title' e 'content' em texto claro.
        db:           Sessão do banco.
        current_user: Usuário autenticado injetado por get_current_user.

    Returns:
        TaskOut: Task criada (HTTP 201).
    """
    # Criptografa antes de montar o objeto ORM para nunca trafegar o dado puro pro banco
    task = Task(
        owner_id=current_user.id,
        title_enc=encrypt(body.title),  # bytes cifrados
        content_enc=encrypt_optional(body.content),  # bytes cifrados ou None
        # 'completed' não é passado aqui pois assume o valor default (False) definido no model
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    # TaskOut.model_validate aciona o método que descriptografa os campos antes de serializar
    return TaskOut.model_validate(task)


@router.get(
    "/",
    response_model=list[TaskOut],
    summary="Listar tasks do usuário (com busca em memória)",
    description=(
        "Retorna todas as tasks do usuário autenticado. "
        "Se um termo de busca for enviado (q), as tasks são filtradas em memória "
        "após a descriptografia."
    ),
)
async def list_tasks(
    q: str | None = Query(
        None, description="Termo para buscar no título ou conteúdo (case insensitive)"
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TaskOut]:
    """
    Lista as tasks do usuário com suporte a busca textual.

    Diferencial de Arquitetura:
    Como os dados no banco estão criptografados, não podemos fazer um `WHERE title LIKE '%q%'`.
    A solução é trazer todas as tasks do usuário para a memória do servidor Python,
    descriptografá-las e aplicar o filtro. Para volumes de dados gigantes, isso exigiria
    outras abordagens (como índices cifrados determinísticos), mas para volumes pessoais,
    é altamente eficiente e mantém a segurança GCM.

    Args:
        q:            String opcional para filtro.
        db:           Sessão do banco.
        current_user: Usuário autenticado.

    Returns:
        list[TaskOut]: Lista de tasks filtradas e descriptografadas.
    """
    # 1. Busca todas as tasks que pertencem ao usuário (isolamento garantido pela chave primária)
    result = await db.execute(
        select(Task)
        .where(Task.owner_id == current_user.id)
        .order_by(
            Task.created_at.desc()
        )  # Ordena das mais recentes para as mais antigas
    )
    tasks_db = result.scalars().all()

    # 2. Converte os modelos do SQLAlchemy para schemas do Pydantic
    #    Neste exato momento, o decorator interno de TaskOut descriptografa os títulos e conteúdos
    decrypted_tasks = [TaskOut.model_validate(t) for t in tasks_db]

    # 3. Aplica o filtro de busca textual em memória (caso o usuário tenha passado o parâmetro 'q')
    if q:
        q_lower = q.lower()
        filtered_tasks = []
        for task in decrypted_tasks:
            # Verifica se o termo buscado está no título (title nunca é None)
            title_match = q_lower in task.title.lower()

            # Verifica se o termo está no conteúdo (content pode ser None, então checamos a existência antes)
            content_match = task.content and q_lower in task.content.lower()

            # Se a string existir no título OU na descrição, a task é validada para o retorno final
            if title_match or content_match:
                filtered_tasks.append(task)

        return filtered_tasks

    # Se a query string for vazia (None), retorna o lote todo
    return decrypted_tasks


@router.get(
    "/{task_id}",
    response_model=TaskOut,
    summary="Obter task por ID",
    description=(
        "Retorna uma task específica se pertencer ao usuário. "
        "Retorna HTTP 404 em vez de 403 para prevenir vazamento de informação da existência do recurso."
    ),
)
async def get_task(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskOut:
    """
    Retorna uma única task baseada no ID.

    O WHERE com dupla checagem (id da task + dono da task) é a espinha dorsal
    da prevenção contra ataques IDOR (Insecure Direct Object Reference).

    Args:
        task_id:      UUID da task na URL.
        db:           Sessão do banco.
        current_user: Usuário autenticado.
    """
    result = await db.execute(
        select(Task).where(
            Task.id == task_id,
            Task.owner_id == current_user.id,
        )
    )
    task = result.scalar_one_or_none()

    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task não encontrada.",
        )

    return TaskOut.model_validate(task)


@router.put(
    "/{task_id}",
    response_model=TaskOut,
    summary="Atualizar task",
    description=(
        "Atualiza a descrição (content) e/ou o status 'completed' de uma task existente. "
        "Pela regra de negócio atual, o título é imutável nesta rota."
    ),
)
async def update_task(
    task_id: uuid.UUID,
    body: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskOut:
    """
    Atualiza apenas os campos permitidos de uma task.

    Se enviar um novo conteúdo, ele sofre uma nova rodada de criptografia
    (que gera um novo 'nonce' internamente e muda a representação em bytes no banco).
    O campo 'completed', sendo um dado binário puro não sensível, é salvo de forma legível.

    Args:
        task_id:      UUID da task a atualizar.
        body:         TaskUpdate com 'content' e 'completed' opcionais.
        db:           Sessão do banco.
        current_user: Usuário autenticado.
    """
    result = await db.execute(
        select(Task).where(
            Task.id == task_id,
            Task.owner_id == current_user.id,
        )
    )
    task = result.scalar_one_or_none()

    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task não encontrada.",
        )

    # Atualização parcial: Verifica isoladamente se cada campo foi preenchido no payload
    if body.content is not None:
        task.content_enc = encrypt(body.content)

    if body.completed is not None:
        task.completed = body.completed

    # Ao fazer o commit, o SQLAlchemy detecta as mudanças nas colunas
    # e aciona a function do banco para atualizar o 'updated_at'
    await db.commit()
    await db.refresh(task)

    return TaskOut.model_validate(task)


@router.delete(
    "/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Deletar task",
    description="Remove permanentemente a task do sistema e desvincula-a do banco.",
)
async def delete_task(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """
    Remove permanentemente uma task.

    O HTTP status 204 é o retorno adequado e padronizado do REST
    indicando o sucesso de um DELETE onde o servidor não precisa retornar
    nenhum conteúdo JSON de volta.

    Args:
        task_id: UUID da task extraído via path parameter.
    """
    result = await db.execute(
        select(Task).where(
            Task.id == task_id,
            Task.owner_id == current_user.id,
        )
    )
    task = result.scalar_one_or_none()

    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task não encontrada.",
        )

    # Operação de deleção rígida no banco (hard delete)
    await db.delete(task)
    await db.commit()
    # O framework cuida de formatar a resposta vazia atrelada ao 204 No Content

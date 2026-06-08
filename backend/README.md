# FastAPI Secure Backend

Backend de demonstração com foco em **segurança de dados em repouso e em trânsito**, construído com FastAPI, SQLAlchemy 2 async e PostgreSQL.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | FastAPI 0.115 |
| Servidor ASGI | Uvicorn |
| ORM | SQLAlchemy 2.x async |
| Driver Postgres | asyncpg |
| Migrações | Alembic |
| Hash de senha | Argon2id (pwdlib) |
| JWT | PyJWT 2.x |
| Criptografia de dados | AES-256-GCM (cryptography) |
| Validação | Pydantic v2 |
| Configuração | pydantic-settings |

---

## Segurança implementada

### Senhas
- Hash **Argon2id** (vencedor do Password Hashing Competition — mais seguro que bcrypt).
- Salt aleatório embutido no hash — nunca reutilizado.
- Comparação em tempo constante (sem timing attack).

### JWT
- **Dois secrets separados**: `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET`.
  Se um vazar, o outro continua seguro.
- Claim `type` em cada token impede uso cruzado (refresh como access e vice-versa).
- Access token: **15 minutos** (curta duração reduz janela de ataque).
- Refresh token: **7 dias**.
- Claims obrigatórios: `sub`, `exp`, `type` validados a cada request.

### Dados no banco (tasks)
- `title` e `content` cifrados com **AES-256-GCM** antes de salvar.
- GCM é autenticado: detecta adulteração dos bytes (integridade + confidencialidade).
- Nonce aleatório de 12 bytes gerado por operação — mesmo texto produz bytes diferentes.
- A chave AES vive apenas em variável de ambiente, nunca no banco.

### Controle de acesso
- Todas as rotas de tasks exigem `Authorization: Bearer <token>`.
- Cada query filtra por `owner_id = current_user.id` — isolamento total entre usuários.
- Acesso a task de outro usuário retorna **404** (não 403) — evita IDOR information leakage.

### Rotas públicas
Apenas três endpoints não exigem autenticação:
```
GET  /health
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
```

---

## Estrutura do projeto

```
backend/
├── app/
│   ├── main.py              # entrypoint FastAPI + lifespan + middlewares
│   ├── config.py            # Settings via pydantic-settings
│   ├── api/
│   │   ├── deps.py          # get_db, get_current_user
│   │   └── v1/
│   │       ├── router.py    # agrega routers da v1
│   │       ├── auth.py      # register, login, refresh
│   │       └── tasks.py     # CRUD de tasks (protegido)
│   ├── core/
│   │   ├── security.py      # Argon2id + JWT
│   │   └── encryption.py    # AES-256-GCM
│   ├── db/
│   │   ├── base.py          # Base declarativa ORM
│   │   └── session.py       # engine + AsyncSessionLocal
│   ├── models/
│   │   ├── user.py          # ORM: User
│   │   └── task.py          # ORM: Task (campos cifrados)
│   └── schemas/
│       ├── user.py          # Pydantic: UserCreate, UserOut, TokenPair
│       └── task.py          # Pydantic: TaskCreate, TaskOut (descriptografa)
├── migrations/              # Alembic
├── tests/
│   ├── conftest.py          # fixtures (SQLite in-memory, client, fake user)
│   ├── test_auth.py
│   └── test_tasks.py
├── .env.example
├── alembic.ini
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

---

## Setup rápido

### 1. Variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env` com valores reais. Gere os secrets:

```bash
# Secret JWT access
python -c "import secrets; print(secrets.token_hex(64))"

# Secret JWT refresh (gere outro valor diferente)
python -c "import secrets; print(secrets.token_hex(64))"

# Chave AES-256 (32 bytes = 64 chars hex)
python -c "import secrets; print(secrets.token_hex(32))"
```

### 2. Subir com Docker Compose

```bash
docker compose up --build
```

O container de backend aguarda o healthcheck do Postgres antes de iniciar.
O Alembic aplica as migrations automaticamente no startup.

API disponível em: `http://localhost:8000`
Swagger (apenas com `DEBUG=true`): `http://localhost:8000/docs`

### 3. Desenvolvimento local (sem Docker)

```bash
# Instala dependências
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Sobe apenas o Postgres com Docker
docker compose up postgres -d

# Edite DATABASE_URL no .env para localhost:
# DATABASE_URL=postgresql+asyncpg://appuser:apppass@localhost:5432/appdb

# Aplica migrations
alembic upgrade head

# Inicia o servidor
uvicorn app.main:app --reload --port 8000
```

---

## Endpoints

### Públicos

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/api/v1/auth/register` | Cadastro de usuário |
| POST | `/api/v1/auth/login` | Login → retorna tokens |
| POST | `/api/v1/auth/refresh` | Renova tokens via refresh token |

### Protegidos (Bearer token obrigatório)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/v1/tasks/` | Criar task |
| GET | `/api/v1/tasks/` | Listar tasks do usuário |
| GET | `/api/v1/tasks/{id}` | Buscar task por ID |
| PUT | `/api/v1/tasks/{id}` | Atualizar task |
| DELETE | `/api/v1/tasks/{id}` | Deletar task |

### Exemplo de uso

```bash
# Cadastro
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@exemplo.com", "password": "SenhaForte1"}'

# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@exemplo.com", "password": "SenhaForte1"}'

# Criar task (substitua TOKEN pelo access_token do login)
curl -X POST http://localhost:8000/api/v1/tasks/ \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Minha task", "content": "Conteúdo secreto"}'
```

---

## Testes

```bash
pip install pytest pytest-asyncio httpx aiosqlite

# Roda todos os testes
pytest tests/ -v

# Com cobertura
pip install pytest-cov
pytest tests/ --cov=app --cov-report=term-missing
```

Os testes usam SQLite em memória — sem dependência de Postgres rodando.

---

## Migrações Alembic

O Alembic gerencia a evolução do esquema do banco de dados. Toda alteração nos modelos (`app/models/`) deve ser acompanhada de uma nova migração.

```bash
# 1. Gerar nova migration após alterar um modelo (executar DENTRO do container)
docker exec -it secure_api_backend alembic revision --autogenerate -m "descrição da mudança"

# 2. Aplicar migrations pendentes
docker exec -it secure_api_backend alembic upgrade head

# 3. Ver histórico
docker exec -it secure_api_backend alembic history

# 4. Reverter uma migration
docker exec -it secure_api_backend alembic downgrade -1
```

---

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | ✅ | URL async do Postgres |
| `JWT_ACCESS_SECRET` | ✅ | Secret do access token |
| `JWT_REFRESH_SECRET` | ✅ | Secret do refresh token (diferente!) |
| `TASK_ENCRYPTION_KEY_HEX` | ✅ | 64 chars hex (AES-256) |
| `JWT_ACCESS_EXPIRE_MINUTES` | ❌ | Padrão: 15 |
| `JWT_REFRESH_EXPIRE_DAYS` | ❌ | Padrão: 7 |
| `DEBUG` | ❌ | Padrão: false |
| `APP_NAME` | ❌ | Nome exibido no Swagger |
a
# SecureTasks — Full Stack

Aplicação full stack de gerenciamento de tarefas com foco em segurança:
dados em repouso cifrados com AES-256-GCM, autenticação JWT com dois tokens separados e hash de senhas Argon2id.

```
.
├── backend/    → FastAPI + SQLAlchemy 2 async + PostgreSQL
├── frontend/   → React 19 + TypeScript + Vite
└── docker-compose.yml
```

---

## Início rápido

```bash
# 1. Clone e entre no projeto
git clone <url>
cd <projeto>

# 2. Configure o backend
cp backend/.env.example backend/.env
# Edite backend/.env com seus secrets (veja backend/README.md)

# 3. Configure o frontend
cp frontend/.env.example frontend/.env
# VITE_API_URL=http://localhost:8000/api/v1

# 4. Suba tudo
docker compose up --build
```

| Serviço | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| Swagger (DEBUG=true) | http://localhost:8000/docs |
| PostgreSQL | localhost:5432 |

---

## Arquitetura

```
┌─────────────────┐     JWT Bearer      ┌─────────────────────────┐
│   React (Vite)  │ ──────────────────► │   FastAPI (Uvicorn)     │
│   :3000         │ ◄────────────────── │   :8000                 │
│                 │   JSON (TaskOut)    │                         │
│  localStorage:  │                    │  AES-256-GCM encrypt    │
│  access_token   │                    │  Argon2id password hash │
│  refresh_token  │                    │  JWT dual-secret        │
└─────────────────┘                    └────────────┬────────────┘
                                                    │ SQLAlchemy async
                                                    ▼
                                       ┌─────────────────────────┐
                                       │   PostgreSQL 16         │
                                       │   :5432                 │
                                       │                         │
                                       │  users.hashed_password  │
                                       │  tasks.title_enc  (bytes)│
                                       │  tasks.content_enc (bytes)│
                                       └─────────────────────────┘
```

**Fluxo de dados sensíveis:**
1. Frontend envia `title` e `content` em texto claro via HTTPS
2. Backend recebe, criptografa com AES-256-GCM e salva os bytes no banco
3. Na leitura, o backend descriptografa e retorna texto claro ao frontend
4. O banco nunca armazena nem processa dados sensíveis em texto claro

---

## Documentação detalhada

- [backend/README.md](./backend/README.md) — stack, endpoints, variáveis, segurança
- [frontend/README.md](./frontend/README.md) — componentes, hooks, fluxo de auth

---

## Segurança em resumo

| Camada | Proteção |
|---|---|
| Senhas | Argon2id (OWASP top recommendation) |
| Tokens | JWT HS256, dois secrets separados, claim `type` anti-confusão |
| Dados | AES-256-GCM: confidencialidade + integridade + autenticidade |
| Acesso | Isolamento por `owner_id`, 404 em vez de 403 para prevenir IDOR |
| Transporte | HTTPS em produção (configure reverse proxy) |
# SecureTasks — Frontend

Interface React para o backend FastAPI seguro. Gerencia autenticação JWT com renovação automática de tokens e operações completas de tasks.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | React 19 |
| Linguagem | TypeScript 6 |
| Build | Vite 8 |
| Estilo | CSS puro (design system via variáveis CSS) |
| HTTP | fetch nativo com interceptor de refresh token |

---

## Estrutura

```
frontend/src/
├── App.tsx                  # Roteamento por estado de auth (autenticado/não)
├── main.tsx                 # Entry point — monta React no DOM
├── index.css                # Design system completo (tokens, componentes, animações)
│
├── types/
│   └── Task.ts              # Interfaces TypeScript (Task, TaskCreate, TaskUpdate, TokenPair, UserOut)
│
├── services/
│   └── api.ts               # Todas as chamadas à API REST + interceptor de refresh
│
├── hooks/
│   ├── useAuth.ts           # Estado de autenticação (login, registro, logout)
│   └── useTasks.ts          # Estado da lista de tasks (CRUD, busca, loading, erros)
│
└── components/
    ├── AuthForm.tsx         # Formulário unificado de login e registro
    ├── TaskList.tsx         # Lista de tasks com barra de busca, toolbar e estados
    ├── TaskCard.tsx         # Card individual com todas as ações
    └── TaskModal.tsx        # Modal de criação e edição de tasks
```

---

## Features implementadas

### Autenticação
- **Login** e **registro** na mesma tela (toggle sem troca de rota)
- **Renovação automática** de access token via refresh token (interceptada no `api.ts`)
- **Logout** limpa tokens do localStorage e redireciona
- Feedback de erro diretamente no formulário (mensagens vindas do backend)

### Tasks — todos os campos do backend expostos
| Campo backend | Exibido no frontend |
|---|---|
| `title` | Texto principal do card |
| `content` | Conteúdo expansível (botão ▼) |
| `completed` | Checkbox com toggle direto |
| `created_at` | Data formatada em pt-BR |
| `updated_at` | Badge "editado" quando diferente do created_at |
| `owner_id` | Não exibido (apenas para isolamento no backend) |

### Operações
- **Criar** task via modal (título obrigatório, conteúdo opcional)
- **Editar** conteúdo e status `completed` (título é somente-leitura, conforme regra do backend)
- **Excluir** com duplo clique para confirmar (evita exclusão acidental)
- **Toggle** completed direto no checkbox do card
- **Busca** textual (envia `?q=termo` ao backend, que filtra em memória após descriptografar)
- Resumo: total / pendentes / concluídas

### UX
- Loading skeleton durante carregamento inicial
- Estado vazio com call-to-action para criar a primeira task
- Erros exibidos inline (no formulário, no modal, na lista)
- Ações do card aparecem no hover (design limpo)
- Confirmação de exclusão auto-cancela após 3 segundos

---

## Setup

### 1. Variáveis de ambiente

```bash
cp .env.example .env
```

O arquivo `.env` deve conter:
```
VITE_API_URL=http://localhost:8000/api/v1
```

> Variáveis do Vite **devem** começar com `VITE_` para serem expostas ao browser.

### 2. Desenvolvimento local

```bash
npm install
npm run dev
```

Frontend disponível em: `http://localhost:5173`

### 3. Build para produção

```bash
npm run build
# Arquivos estáticos gerados em dist/
```

### 4. Com Docker Compose (recomendado)

```bash
# Na raiz do projeto
docker compose up --build
```

Frontend em `http://localhost:3000` (servido pelo Nginx).

---

## Fluxo de autenticação

```
1. Usuário faz login → backend retorna { access_token, refresh_token }
2. Tokens salvos no localStorage
3. Toda requisição protegida → header "Authorization: Bearer <access_token>"
4. Se a resposta for 401 (token expirado):
   a. authFetch chama POST /auth/refresh com o refresh_token
   b. Se ok → salva novos tokens e retenta a requisição original
   c. Se falhar → limpa localStorage e redireciona para login
```

---

## Por que não React Router?

A aplicação tem apenas dois estados: autenticado e não autenticado. Um router completo seria over-engineering aqui. Se o projeto crescer (perfil, admin), basta adicionar React Router e usar `isLogged` como guard nas rotas privadas.

---

## Decisões de arquitetura

**Hooks customizados (`useAuth`, `useTasks`)**
Separam lógica de negócio da camada de apresentação. Componentes só lidam com o que o usuário vê e faz.

**`api.ts` como única fonte de verdade para HTTP**
Todo acesso ao backend passa por esse arquivo. O interceptor de refresh token está centralizado, evitando duplicação.

**Título imutável no modal de edição**
O backend (PUT `/tasks/{id}`) aceita apenas `content` e `completed`. O frontend respeita essa regra: o campo título é exibido como somente-leitura no modo edição, com uma nota explicativa.

**Sem biblioteca de estado global (Redux, Zustand)**
Os dois hooks de estado (`useAuth` + `useTasks`) cobrem todos os casos de uso. Context API seria necessária apenas se múltiplos componentes independentes precisassem compartilhar estado — o que não ocorre nesta arquitetura.
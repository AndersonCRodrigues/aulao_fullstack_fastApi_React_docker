/**
 * services/api.ts
 * ===============
 * Camada de acesso à API REST do backend FastAPI.
 *
 * Responsabilidades:
 *   1. Gerenciar tokens JWT no localStorage (access + refresh).
 *   2. Interceptar respostas 401 e renovar o access token automaticamente
 *      usando o refresh token, sem exigir novo login do usuário.
 *   3. Expor funções tipadas para cada endpoint do backend.
 *
 * Fluxo de autenticação:
 *   Login → recebe {access_token, refresh_token} → salva no localStorage
 *   Toda requisição protegida → envia "Authorization: Bearer <access_token>"
 *   Access token expirado (401) → chama POST /auth/refresh → salva novos tokens
 *   Refresh expirado → limpa tokens e redireciona para login
 *
 * Variável de ambiente necessária:
 *   VITE_API_URL=http://localhost:8000/api/v1
 *   (definida em frontend/.env — use .env.example como base)
 */

import type { Task, TaskCreate, TaskUpdate, TokenPair, UserOut } from '../types/Task';

// Base URL da API vinda da variável de ambiente do Vite.
// Inclui o prefixo /api/v1 para não repetir em cada chamada.
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

// ─── Helpers de Token ──────────────────────────────────────────────────────────

/** Lê o access token do localStorage (pode ser null se não autenticado). */
const getAccessToken = (): string | null => localStorage.getItem('access_token');

/** Lê o refresh token do localStorage. */
const getRefreshToken = (): string | null => localStorage.getItem('refresh_token');

/** Persiste o novo par de tokens após login ou refresh. */
const saveTokens = (tokens: TokenPair): void => {
  localStorage.setItem('access_token', tokens.access_token);
  localStorage.setItem('refresh_token', tokens.refresh_token);
};

/** Remove os tokens e redireciona para a raiz (força novo login). */
const clearTokensAndRedirect = (): void => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  window.location.href = '/';
};

// ─── Interceptor Autenticado ───────────────────────────────────────────────────

/**
 * Wrapper para fetch que injeta o Bearer token e lida com expiração.
 *
 * Se a resposta for 401 (token expirado ou inválido), tenta renovar
 * via POST /auth/refresh com o refresh token. Se o refresh também falhar,
 * desloga o usuário.
 *
 * @param url     - URL completa do endpoint
 * @param options - RequestInit padrão do fetch
 * @returns       - Response já com o token correto
 */
const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  // Injeta o token atual no header Authorization
  const headersWithAuth = {
    'Content-Type': 'application/json',
    ...options.headers,
    Authorization: `Bearer ${getAccessToken()}`,
  };

  const response = await fetch(url, { ...options, headers: headersWithAuth });

  // Se não for 401, retorna direto (sucesso ou outro erro tratado pelo chamador)
  if (response.status !== 401) return response;

  // ─── Tentativa de renovação do token ────────────────────────────────────────
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    // Sem refresh token — desloga imediatamente
    clearTokensAndRedirect();
    throw new Error('Sessão encerrada: sem refresh token.');
  }

  const refreshResponse = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!refreshResponse.ok) {
    // Refresh expirado ou inválido — força novo login
    clearTokensAndRedirect();
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  // Salva os novos tokens e retenta a requisição original
  const newTokens: TokenPair = await refreshResponse.json();
  saveTokens(newTokens);

  const retryHeaders = {
    'Content-Type': 'application/json',
    ...options.headers,
    Authorization: `Bearer ${newTokens.access_token}`,
  };

  return fetch(url, { ...options, headers: retryHeaders });
};

// ─── API Pública ───────────────────────────────────────────────────────────────

export const api = {
  // ── Autenticação (endpoints públicos) ────────────────────────────────────────

  /**
   * Registra um novo usuário.
   * POST /auth/register
   *
   * @returns UserOut com os dados públicos do usuário criado (sem senha).
   * @throws Error com a mensagem do backend (ex: "E-mail já cadastrado.")
   */
  register: async (email: string, password: string): Promise<UserOut> => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Erro ao registrar.' }));
      throw new Error(err.detail ?? 'Erro ao registrar.');
    }

    return res.json();
  },

  /**
   * Autentica o usuário com email e senha.
   * POST /auth/login
   *
   * Salva os tokens automaticamente no localStorage após sucesso.
   * @returns TokenPair com access_token e refresh_token.
   */
  login: async (email: string, password: string): Promise<TokenPair> => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'E-mail ou senha inválidos.' }));
      throw new Error(err.detail ?? 'E-mail ou senha inválidos.');
    }

    const tokens: TokenPair = await res.json();
    saveTokens(tokens);
    return tokens;
  },

  /**
   * Remove os tokens do localStorage e redireciona para login.
   * (Logout é client-side — não há endpoint de logout no backend stateless)
   */
  logout: (): void => {
    clearTokensAndRedirect();
  },

  /**
   * Verifica se o usuário está autenticado (tem access token no localStorage).
   * Atenção: não valida a assinatura JWT — só verifica a presença do token.
   */
  isAuthenticated: (): boolean => !!getAccessToken(),

  // ── Tasks (endpoints protegidos) ─────────────────────────────────────────────

  /**
   * Lista todas as tasks do usuário autenticado.
   * GET /tasks/?q={search}
   *
   * Se `search` for informado, o backend aplica busca em memória
   * (após descriptografar os campos) no título e no conteúdo.
   *
   * @param search - Termo de busca opcional (case insensitive)
   * @returns Array de Tasks descriptografadas
   */
  getTasks: async (search: string = ''): Promise<Task[]> => {
    const query = search ? `?q=${encodeURIComponent(search)}` : '';
    const res = await authFetch(`${BASE_URL}/tasks/${query}`);

    if (!res.ok) throw new Error('Erro ao buscar tasks.');
    return res.json();
  },

  /**
   * Busca uma task específica pelo UUID.
   * GET /tasks/{id}
   *
   * Retorna 404 se a task não existir OU pertencer a outro usuário
   * (o backend usa 404 para prevenir IDOR information leakage).
   */
  getTask: async (id: string): Promise<Task> => {
    const res = await authFetch(`${BASE_URL}/tasks/${id}`);

    if (!res.ok) throw new Error('Task não encontrada.');
    return res.json();
  },

  /**
   * Cria uma nova task para o usuário autenticado.
   * POST /tasks/
   *
   * O backend criptografa title e content com AES-256-GCM antes de salvar.
   * O campo `completed` inicia como false automaticamente.
   *
   * @returns Task criada (com id, timestamps, completed=false)
   */
  createTask: async (data: TaskCreate): Promise<Task> => {
    const res = await authFetch(`${BASE_URL}/tasks/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Erro ao criar task.' }));
      throw new Error(err.detail ?? 'Erro ao criar task.');
    }

    return res.json();
  },

  /**
   * Atualiza content e/ou completed de uma task existente.
   * PUT /tasks/{id}
   *
   * Nota: o título é imutável por esta rota (regra de negócio do backend).
   * Apenas `content` e `completed` são aceitos no payload.
   *
   * @returns Task atualizada com os novos valores
   */
  updateTask: async (id: string, updates: TaskUpdate): Promise<Task> => {
    const res = await authFetch(`${BASE_URL}/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Erro ao atualizar task.' }));
      throw new Error(err.detail ?? 'Erro ao atualizar task.');
    }

    return res.json();
  },

  /**
   * Remove permanentemente uma task (hard delete).
   * DELETE /tasks/{id}
   *
   * Retorna 204 No Content em caso de sucesso.
   */
  deleteTask: async (id: string): Promise<void> => {
    const res = await authFetch(`${BASE_URL}/tasks/${id}`, { method: 'DELETE' });

    if (!res.ok) throw new Error('Erro ao deletar task.');
  },
};
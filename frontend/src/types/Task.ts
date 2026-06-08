/**
 * types/Task.ts
 * ============
 * Tipagem TypeScript para o modelo Task.
 *
 * Este tipo reflete EXATAMENTE o schema `TaskOut` do backend (FastAPI + Pydantic).
 * O backend descriptografa `title_enc` e `content_enc` antes de serializar —
 * então o frontend NUNCA vê bytes cifrados, apenas texto claro.
 *
 * Campos vindos do backend:
 *   id         → UUID da task (gerado pelo banco)
 *   owner_id   → UUID do usuário dono da task
 *   title      → texto claro (descriptografado pelo backend)
 *   content    → texto claro ou null (campo opcional)
 *   completed  → boolean: tarefa concluída ou não
 *   created_at → timestamp ISO 8601 (com timezone)
 *   updated_at → timestamp ISO 8601 (com timezone)
 */
export interface Task {
  id: string;
  owner_id: string;
  title: string;
  content: string | null; // opcional no backend — pode ser null
  completed: boolean;
  created_at: string;     // ISO 8601, ex: "2024-06-01T12:00:00+00:00"
  updated_at: string;
}

/**
 * Payload para criação de task (POST /tasks/).
 * Corresponde ao schema `TaskCreate` do backend.
 */
export interface TaskCreate {
  title: string;
  content?: string | null;
}

/**
 * Payload para atualização de task (PUT /tasks/{id}).
 * Corresponde ao schema `TaskUpdate` do backend.
 * Apenas `content` e `completed` podem ser alterados (título é imutável via PUT).
 */
export interface TaskUpdate {
  content?: string | null;
  completed?: boolean;
}

/**
 * Par de tokens retornado pelo login/refresh.
 * Corresponde ao schema `TokenPair` do backend.
 */
export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string; // sempre "bearer"
}

/**
 * Dados públicos do usuário retornados pelo registro.
 * Corresponde ao schema `UserOut` do backend.
 */
export interface UserOut {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
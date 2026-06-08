/**
 * components/TaskList.tsx
 * =======================
 * Componente principal da lista de tasks.
 *
 * Orquestra:
 *   - Barra de busca textual (GET /tasks/?q=...)
 *   - Botão de nova task (abre TaskModal em modo criação)
 *   - Lista de TaskCard com todas as ações (toggle, editar, deletar)
 *   - Feedback visual: loading skeleton, estado vazio, erros
 *
 * Arquitetura:
 *   TaskList não faz chamadas de API diretamente — delega ao hook useTasks.
 *   Isso mantém o componente focado apenas na apresentação e interação do usuário.
 *
 * Props:
 *   onLogout → callback para deslogar (disparado pelo botão no header)
 */

import { useState } from 'react';
import { useTasks } from '../hooks/useTasks';
import type { Task, TaskCreate, TaskUpdate } from '../types/Task';
import { TaskCard } from './TaskCard';
import { TaskModal } from './TaskModal';

interface TaskListProps {
  onLogout: () => void;
}

export const TaskList = ({ onLogout }: TaskListProps) => {
  // Toda a lógica de dados vem do hook — o componente só precisa do estado da UI
  const {
    tasks,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    createTask,
    updateTask,
    deleteTask,
    toggleComplete,
    clearError,
  } = useTasks();

  // Estado do modal de criação/edição
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // ── Handlers do Modal ──────────────────────────────────────────────────────

  /** Abre modal para criar nova task */
  const openCreateModal = () => {
    setEditingTask(null);
    setModalError(null);
    setModalOpen(true);
  };

  /** Abre modal para editar task existente */
  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setModalError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingTask(null);
    setModalError(null);
  };

  /**
   * Handler unificado para submit do modal.
   * O tipo de dados depende do modo (criação ou edição).
   */
  const handleModalSubmit = async (data: TaskCreate | TaskUpdate) => {
    setModalLoading(true);
    setModalError(null);
    try {
      if (editingTask) {
        await updateTask(editingTask.id, data as TaskUpdate);
      } else {
        await createTask(data as TaskCreate);
      }
      closeModal();
    } catch (err) {
      // Exibe o erro dentro do modal (não fecha o modal em caso de erro)
      setModalError(err instanceof Error ? err.message : 'Erro ao salvar task.');
    } finally {
      setModalLoading(false);
    }
  };

  // ── Contadores para o resumo ───────────────────────────────────────────────
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed).length;
  const pendingTasks = totalTasks - completedTasks;

  return (
    <div className="task-list-wrapper">
      {/* Header com título e botão de logout */}
      <header className="app-header">
        <div className="app-header__left">
          <span className="app-logo">✓</span>
          <h1 className="app-title">SecureTasks</h1>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onLogout}
          title="Sair da conta"
        >
          Sair
        </button>
      </header>

      <main className="task-list-main">
        {/* Resumo de tarefas */}
        <div className="task-summary">
          <div className="task-summary__item">
            <span className="task-summary__count">{totalTasks}</span>
            <span className="task-summary__label">total</span>
          </div>
          <div className="task-summary__divider" />
          <div className="task-summary__item">
            <span className="task-summary__count task-summary__count--pending">
              {pendingTasks}
            </span>
            <span className="task-summary__label">pendentes</span>
          </div>
          <div className="task-summary__divider" />
          <div className="task-summary__item">
            <span className="task-summary__count task-summary__count--done">
              {completedTasks}
            </span>
            <span className="task-summary__label">concluídas</span>
          </div>
        </div>

        {/* Barra de ações: busca + nova task */}
        <div className="task-toolbar">
          <div className="search-wrapper">
            <span className="search-icon" aria-hidden="true">🔍</span>
            <input
              type="search"
              className="search-input"
              placeholder="Buscar por título ou conteúdo…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Buscar tasks"
            />
            {/* Botão para limpar a busca */}
            {searchTerm && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setSearchTerm('')}
                aria-label="Limpar busca"
              >
                ×
              </button>
            )}
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={openCreateModal}
          >
            + Nova tarefa
          </button>
        </div>

        {/* Erro global da lista */}
        {error && (
          <div className="list-error" role="alert">
            <span>⚠ {error}</span>
            <button
              type="button"
              className="btn-link"
              onClick={clearError}
              aria-label="Fechar aviso de erro"
            >
              ×
            </button>
          </div>
        )}

        {/* Estado de carregamento */}
        {loading && tasks.length === 0 && (
          <div className="loading-state" aria-label="Carregando tasks…">
            {[1, 2, 3].map((i) => (
              <div key={i} className="task-skeleton" aria-hidden="true">
                <div className="skeleton-checkbox" />
                <div className="skeleton-text" />
              </div>
            ))}
          </div>
        )}

        {/* Estado vazio */}
        {!loading && tasks.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__icon">📋</div>
            <p className="empty-state__title">
              {searchTerm
                ? `Nenhuma tarefa encontrada para "${searchTerm}"`
                : 'Nenhuma tarefa ainda'}
            </p>
            <p className="empty-state__subtitle">
              {searchTerm
                ? 'Tente um termo diferente ou limpe a busca.'
                : 'Crie sua primeira tarefa clicando em "+ Nova tarefa".'}
            </p>
            {!searchTerm && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={openCreateModal}
              >
                Criar primeira tarefa
              </button>
            )}
          </div>
        )}

        {/* Lista de tasks */}
        {tasks.length > 0 && (
          <ul className="task-list" aria-label="Lista de tarefas">
            {tasks.map((task) => (
              <li key={task.id}>
                <TaskCard
                  task={task}
                  onToggle={toggleComplete}
                  onEdit={openEditModal}
                  onDelete={deleteTask}
                />
              </li>
            ))}
          </ul>
        )}

        {/* Indicador de loading durante busca (tasks já carregadas) */}
        {loading && tasks.length > 0 && (
          <div className="loading-overlay" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <span>Atualizando…</span>
          </div>
        )}
      </main>

      {/* Modal de criação/edição */}
      <TaskModal
        isOpen={modalOpen}
        onClose={closeModal}
        onSubmit={handleModalSubmit}
        task={editingTask}
        loading={modalLoading}
        error={modalError}
      />
    </div>
  );
};
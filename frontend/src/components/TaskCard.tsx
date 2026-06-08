/**
 * components/TaskCard.tsx
 * =======================
 * Card de exibição de uma task individual.
 *
 * Exibe todos os campos retornados pelo backend (TaskOut):
 *   - title          → texto claro (descriptografado pelo backend)
 *   - content        → opcional, mostrável via expansão
 *   - completed      → checkbox visual com toggle direto
 *   - created_at     → data formatada em pt-BR
 *   - updated_at     → exibido quando diferente do created_at
 *
 * Ações disponíveis:
 *   - Toggle completed (click no checkbox ou no título)
 *   - Editar (abre TaskModal em modo edição)
 *   - Deletar (com confirmação inline para evitar exclusões acidentais)
 *
 * Props:
 *   task        → objeto Task completo
 *   onToggle    → callback para alternar completed
 *   onEdit      → callback para abrir o modal de edição
 *   onDelete    → callback para deletar a task
 */

import { useState } from 'react';
import type { Task } from '../types/Task';

interface TaskCardProps {
  task: Task;
  onToggle: (task: Task) => Promise<void>;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => Promise<void>;
}

/**
 * Formata um timestamp ISO 8601 para data legível em pt-BR.
 * Ex: "2024-06-01T12:00:00+00:00" → "01/06/2024 09:00"
 */
const formatDate = (iso: string): string => {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const TaskCard = ({ task, onToggle, onEdit, onDelete }: TaskCardProps) => {
  // Controla se o conteúdo está expandido ou recolhido
  const [contentExpanded, setContentExpanded] = useState(false);
  // Controla o estado de confirmação de exclusão (evita delete acidental)
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Controla loading individual por ação (toggle, delete)
  const [actionLoading, setActionLoading] = useState<'toggle' | 'delete' | null>(null);

  const isEdited = task.updated_at !== task.created_at;

  const handleToggle = async () => {
    setActionLoading('toggle');
    try {
      await onToggle(task);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteClick = () => {
    if (confirmingDelete) {
      // Segunda vez → confirma a exclusão
      handleDeleteConfirm();
    } else {
      // Primeira vez → entra em modo de confirmação
      setConfirmingDelete(true);
      // Auto-cancela a confirmação após 3 segundos
      setTimeout(() => setConfirmingDelete(false), 3000);
    }
  };

  const handleDeleteConfirm = async () => {
    setActionLoading('delete');
    try {
      await onDelete(task.id);
    } finally {
      setActionLoading(null);
      setConfirmingDelete(false);
    }
  };

  return (
    <div className={`task-card ${task.completed ? 'task-card--done' : ''}`}>
      {/* Linha principal: checkbox + título + ações */}
      <div className="task-card__main">
        {/* Checkbox de conclusão */}
        <button
          type="button"
          className={`task-checkbox ${task.completed ? 'task-checkbox--checked' : ''}`}
          onClick={handleToggle}
          disabled={actionLoading === 'toggle'}
          aria-label={task.completed ? 'Marcar como pendente' : 'Marcar como concluída'}
          title={task.completed ? 'Marcar como pendente' : 'Marcar como concluída'}
        >
          {actionLoading === 'toggle' ? (
            <span className="spinner spinner--sm" aria-hidden="true" />
          ) : task.completed ? (
            '✓'
          ) : null}
        </button>

        {/* Título */}
        <span
          className={`task-title ${task.completed ? 'task-title--done' : ''}`}
          title={task.title}
        >
          {task.title}
        </span>

        {/* Ações */}
        <div className="task-actions">
          {/* Expandir conteúdo (só exibe se há conteúdo) */}
          {task.content && (
            <button
              type="button"
              className="btn-icon"
              onClick={() => setContentExpanded((v) => !v)}
              aria-label={contentExpanded ? 'Recolher conteúdo' : 'Expandir conteúdo'}
              title={contentExpanded ? 'Recolher' : 'Ver detalhes'}
            >
              {contentExpanded ? '▲' : '▼'}
            </button>
          )}

          {/* Editar */}
          <button
            type="button"
            className="btn-icon btn-icon--edit"
            onClick={() => onEdit(task)}
            disabled={actionLoading !== null}
            aria-label="Editar tarefa"
            title="Editar"
          >
            ✎
          </button>

          {/* Deletar — dois cliques para confirmar */}
          <button
            type="button"
            className={`btn-icon btn-icon--delete ${confirmingDelete ? 'btn-icon--confirming' : ''}`}
            onClick={handleDeleteClick}
            disabled={actionLoading === 'delete'}
            aria-label={confirmingDelete ? 'Confirmar exclusão' : 'Excluir tarefa'}
            title={confirmingDelete ? 'Clique novamente para confirmar' : 'Excluir'}
          >
            {actionLoading === 'delete' ? (
              <span className="spinner spinner--sm" aria-hidden="true" />
            ) : confirmingDelete ? (
              '?'
            ) : (
              '✕'
            )}
          </button>
        </div>
      </div>

      {/* Conteúdo expandível */}
      {task.content && contentExpanded && (
        <div className="task-content">
          <p className="task-content__text">{task.content}</p>
        </div>
      )}

      {/* Metadados */}
      <div className="task-meta">
        <span className="task-meta__date" title={`Criado em: ${formatDate(task.created_at)}`}>
          📅 {formatDate(task.created_at)}
        </span>
        {isEdited && (
          <span
            className="task-meta__edited"
            title={`Editado em: ${formatDate(task.updated_at)}`}
          >
            ✎ editado
          </span>
        )}
        {task.completed && (
          <span className="task-meta__badge task-meta__badge--done">concluída</span>
        )}
      </div>
    </div>
  );
};
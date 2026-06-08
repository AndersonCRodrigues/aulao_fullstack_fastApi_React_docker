/**
 * components/TaskModal.tsx
 * ========================
 * Modal para criação e edição de tasks.
 *
 * Suporta dois modos:
 *   CREATE → title obrigatório, content opcional, completed=false
 *   EDIT   → title é exibido (somente leitura, backend não permite alterar),
 *             content editável, completed editável via checkbox
 *
 * Por que title é somente-leitura no modo edição?
 *   O endpoint PUT /tasks/{id} aceita apenas `content` e `completed`.
 *   Esta é uma regra de negócio do backend — o título é imutável após criação.
 *
 * Por que não há useEffect para sincronizar `task` → estado local?
 *   O componente recebe uma `key` no pai (key={task?.id ?? 'new'}), o que força
 *   remount completo sempre que a task muda. O estado inicial é derivado via
 *   inicializador lazy do useState, eliminando renders cascateados.
 *
 * Acessibilidade:
 *   - role="dialog" + aria-modal + aria-labelledby para leitores de tela
 *   - Foco automático no primeiro campo ao abrir
 *   - Fecha ao pressionar Escape ou clicar no overlay
 *
 * Props:
 *   isOpen    → controla visibilidade do modal
 *   onClose   → callback ao fechar (sem salvar)
 *   onSubmit  → callback com os dados do formulário
 *   task      → se informado, entra em modo edição com os dados pré-preenchidos
 *   loading   → desabilita o formulário durante a requisição
 *   error     → exibe erro inline no modal
 *
 * Uso no pai (obrigatório para reset de estado correto):
 *   <TaskModal key={task?.id ?? 'new'} task={task} ... />
 */

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { Task, TaskCreate, TaskUpdate } from '../types/Task';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TaskCreate | TaskUpdate) => Promise<void>;
  task?: Task | null; // se fornecido → modo edição
  loading?: boolean;
  error?: string | null;
}

export const TaskModal = ({
  isOpen,
  onClose,
  onSubmit,
  task = null,
  loading = false,
  error = null,
}: TaskModalProps) => {
  const isEditMode = !!task;

  // Estado inicial derivado diretamente da prop via inicializador lazy.
  // O reset acontece via remount (key no pai), não via efeito.
  const [title, setTitle] = useState(() => task?.title ?? '');
  const [content, setContent] = useState(() => task?.content ?? '');
  const [completed, setCompleted] = useState(() => task?.completed ?? false);

  // Referência para focar o primeiro campo ao abrir o modal
  const firstInputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Foco automático — único propósito deste efeito: manipular o DOM
  useEffect(() => {
    if (!isOpen) return;
    const id = setTimeout(() => {
      (firstInputRef.current as HTMLElement | null)?.focus();
    }, 50);
    return () => clearTimeout(id);
  }, [isOpen]);

  // Fecha o modal ao pressionar Escape
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && !loading) onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (isEditMode) {
      // Modo edição: envia apenas os campos permitidos pelo backend (content + completed)
      const updates: TaskUpdate = {
        content: content || null,
        completed,
      };
      await onSubmit(updates);
    } else {
      // Modo criação: envia title (obrigatório) + content (opcional)
      const createData: TaskCreate = {
        title,
        content: content || null,
      };
      await onSubmit(createData);
    }
  };

  if (!isOpen) return null;

  return (
    /* Overlay — clicar fora fecha o modal */
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && !loading && onClose()}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Cabeçalho */}
        <div className="modal-header">
          <h2 id="modal-title" className="modal-title">
            {isEditMode ? 'Editar tarefa' : 'Nova tarefa'}
          </h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={loading}
            aria-label="Fechar modal"
          >
            ×
          </button>
        </div>

        {/* Erro inline */}
        {error && (
          <div className="modal-error" role="alert">
            <span>⚠</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Título — somente leitura em edição (backend não permite alterar) */}
          <div className="field-group">
            <label htmlFor="task-title" className="field-label">
              Título {!isEditMode && <span className="required">*</span>}
              {isEditMode && (
                <span className="field-hint"> (não pode ser alterado)</span>
              )}
            </label>
            {isEditMode ? (
              /* Em modo edição, mostra o título como texto estático */
              <div className="field-readonly">{task?.title}</div>
            ) : (
              <input
                id="task-title"
                ref={firstInputRef as React.RefObject<HTMLInputElement>}
                type="text"
                className="field-input"
                placeholder="Ex: Revisar documentação"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                disabled={loading}
                maxLength={200}
              />
            )}
          </div>

          {/* Conteúdo — editável em ambos os modos */}
          <div className="field-group">
            <label htmlFor="task-content" className="field-label">
              Conteúdo
              <span className="field-hint"> (opcional)</span>
            </label>
            <textarea
              id="task-content"
              ref={!isEditMode ? undefined : (firstInputRef as React.RefObject<HTMLTextAreaElement>)}
              className="field-input field-textarea"
              placeholder="Descreva os detalhes da tarefa…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={loading}
              rows={4}
            />
          </div>

          {/* Checkbox de conclusão — visível apenas no modo edição */}
          {isEditMode && (
            <div className="field-group field-checkbox-group">
              <label className="field-checkbox-label">
                <input
                  type="checkbox"
                  className="field-checkbox"
                  checked={completed}
                  onChange={(e) => setCompleted(e.target.checked)}
                  disabled={loading}
                />
                <span>Marcar como concluída</span>
              </label>
            </div>
          )}

          {/* Ações */}
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || (!isEditMode && !title.trim())}
            >
              {loading ? (
                <span className="btn-loading">
                  <span className="spinner" aria-hidden="true" />
                  {isEditMode ? 'Salvando…' : 'Criando…'}
                </span>
              ) : isEditMode ? (
                'Salvar alterações'
              ) : (
                'Criar tarefa'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
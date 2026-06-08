import { useState } from 'react';
import { api } from '../services/api';
import './TaskModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const TaskModal = ({ isOpen, onClose, onSuccess }: Props) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createTask(title, content);
    setTitle('');
    setContent('');
    onSuccess(); // Recarrega a lista
    onClose();   // Fecha o modal
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <form onSubmit={handleSubmit}>
          <input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <textarea placeholder="Conteúdo" value={content} onChange={(e) => setContent(e.target.value)} />
          <button type="submit">Salvar</button>
          <button type="button" onClick={onClose}>Cancelar</button>
        </form>
      </div>
    </div>
  );
};
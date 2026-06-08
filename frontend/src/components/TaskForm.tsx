import { useState } from 'react';
import { api } from '../services/api';

export const TaskForm = ({ onTaskCreated }: { onTaskCreated: () => void }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createTask(title, content);
    onTaskCreated(); // Atualiza a lista após criar
  };

  return (
    <form onSubmit={handleSubmit}>
      <input placeholder="Título" onChange={(e) => setTitle(e.target.value)} />
      <input placeholder="Conteúdo" onChange={(e) => setContent(e.target.value)} />
      <button type="submit">Criar Tarefa</button>
    </form>
  );
};
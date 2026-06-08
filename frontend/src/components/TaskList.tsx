import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { Task } from '../types/Task';
import './TaskList.css';
import { TaskModal } from './TaskModal';

export const TaskList = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      try {
        const data = await api.getTasks(search);
        if (active) {
          setTasks(data);
        }
      } catch (err) {
        console.error("Erro ao carregar tasks:", err);
      }
    };

    fetchData();

    return () => {
      active = false;
    };
  }, [search]);

  const handleUpdate = async () => {
    // Função utilitária interna para atualizar a lista após ações
    const data = await api.getTasks(search);
    setTasks(data);
  };

  const handleDelete = async (id: string) => {
    await api.deleteTask(id);
    await handleUpdate();
  };

  const toggleComplete = async (task: Task) => {
    await api.updateTask(task.id, { completed: !task.completed });
    await handleUpdate();
  };

  return (
    <div className="task-container">
      <input
        placeholder="Buscar..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <button onClick={() => setIsModalOpen(true)}>+ Nova Task</button>

      <ul>
        {tasks.map((t) => (
          <li key={t.id} className={t.completed ? 'done' : ''}>
            <span onClick={() => toggleComplete(t)} style={{ cursor: 'pointer' }}>
              {t.title}
            </span>
            <button onClick={() => handleDelete(t.id)}>Excluir</button>
          </li>
        ))}
      </ul>

      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleUpdate}
      />
    </div>
  );
};
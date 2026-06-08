/**
 * hooks/useTasks.ts
 * =================
 * Hook customizado para gerenciar a lista de tasks do usuário.
 *
 * Responsabilidades:
 *   - Buscar tasks do backend (com suporte a busca textual)
 *   - Criar, atualizar e deletar tasks
 *   - Controlar estado de loading e erros por operação
 *   - Re-buscar automaticamente quando o termo de busca muda
 *
 * Por que NÃO usamos useCallback + useEffect(fn, [fn])?
 * -------------------------------------------------------
 * O padrão antigo era:
 *   const fetchTasks = useCallback(async () => { ... }, [searchTerm]);
 *   useEffect(() => { fetchTasks(); }, [fetchTasks]);
 *
 * O novo eslint-plugin-react-hooks (v7+) marca isso como erro
 * `react-hooks/set-state-in-effect` porque chamar setState de
 * dentro de uma função async no body do effect pode causar renders
 * em cascata — mesmo que aqui seja seguro por ser async.
 *
 * Solução: colocar a lógica de fetch DENTRO do próprio useEffect,
 * usando uma função local (não memoizada). O effect já sabe quando
 * rodar pelas dependências diretas ([searchTerm, refreshCount]).
 * Para "forçar" um refresh manual, incrementamos `refreshCount`.
 *
 * Esse padrão é explicitamente recomendado em:
 * https://react.dev/learn/you-might-not-need-an-effect
 */

import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import type { Task, TaskCreate, TaskUpdate } from '../types/Task';

interface UseTasksReturn {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  createTask: (data: TaskCreate) => Promise<void>;
  updateTask: (id: string, updates: TaskUpdate) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleComplete: (task: Task) => Promise<void>;
  refreshTasks: () => void;
  clearError: () => void;
}

export const useTasks = (): UseTasksReturn => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  /**
   * Contador de refresh manual.
   * Incrementar este valor força o useEffect a rodar novamente,
   * sem precisar expor a função de fetch como dependência.
   */
  const [refreshCount, setRefreshCount] = useState(0);

  /**
   * Ref para abortar requisições pendentes quando o componente
   * desmonta ou quando searchTerm muda antes da resposta chegar.
   * Evita o erro "Can't perform a React state update on an unmounted component".
   */
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    /**
     * Toda a lógica de fetch fica DENTRO do effect — padrão recomendado
     * pelo React e aceito pelo eslint-plugin-react-hooks v7+.
     *
     * Vantagens:
     *   - Sem useCallback (menos complexidade)
     *   - Sem dependência de função memoizada no array de deps
     *   - Cancelamento limpo via AbortController no cleanup
     */
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await api.getTasks(searchTerm);

        // Só atualiza o estado se o effect ainda estiver ativo
        // (não foi cancelado por unmount ou mudança de searchTerm)
        if (!controller.signal.aborted) {
          setTasks(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar tasks.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    run();

    // Cleanup: cancela a requisição se o effect rodar novamente
    // antes da anterior terminar (ex: usuário digita rápido na busca)
    return () => {
      controller.abort();
    };
  }, [searchTerm, refreshCount]); // re-executa quando o termo de busca ou o contador muda

  /**
   * Força um novo fetch sem mudar o searchTerm.
   * Útil para sincronizar após operações externas.
   */
  const refreshTasks = () => setRefreshCount((c) => c + 1);

  /**
   * Cria uma nova task e a insere no início da lista local (optimistic update).
   * Se a criação falhar, relança o erro para o componente tratar (ex: fechar modal).
   */
  const createTask = async (data: TaskCreate): Promise<void> => {
    setError(null);
    try {
      const created = await api.createTask(data);
      // Insere no início — mesma ordenação do backend (created_at DESC)
      setTasks((prev) => [created, ...prev]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar task.';
      setError(msg);
      throw err;
    }
  };

  /**
   * Atualiza uma task e reflete a mudança localmente sem nova requisição ao backend.
   * O backend retorna o objeto atualizado — substituímos o item na lista.
   */
  const updateTask = async (id: string, updates: TaskUpdate): Promise<void> => {
    setError(null);
    try {
      const updated = await api.updateTask(id, updates);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar task.';
      setError(msg);
      throw err;
    }
  };

  /**
   * Deleta uma task e a remove da lista local imediatamente.
   */
  const deleteTask = async (id: string): Promise<void> => {
    setError(null);
    try {
      await api.deleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao deletar task.';
      setError(msg);
      throw err;
    }
  };

  /**
   * Atalho para alternar completed de uma task.
   * Chama updateTask com o valor invertido.
   */
  const toggleComplete = async (task: Task): Promise<void> => {
    await updateTask(task.id, { completed: !task.completed });
  };

  const clearError = (): void => setError(null);

  return {
    tasks,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    createTask,
    updateTask,
    deleteTask,
    toggleComplete,
    refreshTasks,
    clearError,
  };
};
/**
 * hooks/useAuth.ts
 * ================
 * Hook customizado para gerenciar o estado de autenticação do usuário.
 *
 * Por que um hook separado?
 *   - Centraliza a lógica de login/registro/logout em um só lugar.
 *   - Componentes consomem apenas o que precisam (isLogged, login, etc.)
 *   - Facilita testes e futura migração para Context/Redux.
 *
 * Estado mantido:
 *   isLogged → true se há access_token no localStorage
 *   loading  → true enquanto uma operação assíncrona está em curso
 *   error    → mensagem de erro da última operação (null se ok)
 */

import { useState } from 'react';
import { api } from '../services/api';

interface UseAuthReturn {
  isLogged: boolean;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuth = (): UseAuthReturn => {
  // Inicializa isLogged lendo o localStorage (persiste o estado entre refreshes de página)
  const [isLogged, setIsLogged] = useState<boolean>(api.isAuthenticated());
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Autentica o usuário com email e senha.
   * Em caso de sucesso, atualiza isLogged para true.
   */
  const login = async (email: string, password: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await api.login(email, password);
      setIsLogged(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Registra um novo usuário e em seguida faz login automático.
   * O backend retorna 201 com UserOut — o frontend faz login na sequência.
   */
  const register = async (email: string, password: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await api.register(email, password);
      // Registro bem-sucedido → loga automaticamente para melhor UX
      await api.login(email, password);
      setIsLogged(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Remove os tokens e define isLogged=false.
   * A api.logout() redireciona para '/', mas setIsLogged garante
   * que o componente React também reage imediatamente.
   */
  const logout = (): void => {
    setIsLogged(false);
    api.logout();
  };

  const clearError = (): void => setError(null);

  return { isLogged, loading, error, login, register, logout, clearError };
};
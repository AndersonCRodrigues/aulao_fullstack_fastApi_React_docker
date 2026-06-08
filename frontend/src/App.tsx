/**
 * App.tsx
 * =======
 * Componente raiz da aplicação.
 *
 * Responsabilidade única:
 *   Decidir qual tela exibir com base no estado de autenticação.
 *
 * Fluxo de navegação:
 *   NÃO autenticado → <AuthForm>  (login + registro)
 *   Autenticado     → <TaskList>  (lista de tasks com todas as ações)
 *
 * Por que não usar React Router?
 *   A aplicação tem apenas dois estados — autenticado e não autenticado.
 *   Um router completo seria over-engineering para este caso.
 *   O hook useAuth gerencia esse estado de forma limpa.
 *
 * Escalabilidade:
 *   Se o projeto crescer (ex: rota de perfil, admin), basta adicionar
 *   React Router e usar `isLogged` como guard nas rotas privadas.
 */

import { AuthForm } from './components/AuthForm';
import { TaskList } from './components/TaskList';
import { useAuth } from './hooks/useAuth';

function App() {
  const { isLogged, loading, error, login, register, logout, clearError } = useAuth();

  // Usuário autenticado → exibe a aplicação principal
  if (isLogged) {
    return <TaskList onLogout={logout} />;
  }

  // Não autenticado → exibe o formulário de auth
  return (
    <AuthForm
      onLogin={login}
      onRegister={register}
      loading={loading}
      error={error}
      onClearError={clearError}
    />
  );
}

export default App;
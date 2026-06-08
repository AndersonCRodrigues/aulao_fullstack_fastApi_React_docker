/**
 * components/AuthForm.tsx
 * =======================
 * Formulário unificado de Login e Registro.
 *
 * Features:
 *   - Toggle entre modo "Login" e "Criar conta" sem trocar de página
 *   - Exibe mensagens de erro do backend diretamente no formulário
 *   - Botão desabilitado + spinner enquanto a requisição está em andamento
 *   - Acessibilidade: labels associados aos inputs, aria-live para erros
 *
 * Props:
 *   onLogin  → callback chamado após autenticação bem-sucedida
 *   loading  → controla o estado de carregamento (vem do hook useAuth)
 *   error    → mensagem de erro atual (null = sem erro)
 *   onClearError → limpa o erro ao usuário começar a digitar
 */

import { useState, type FormEvent } from 'react';

interface AuthFormProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  onClearError: () => void;
}

export const AuthForm = ({
  onLogin,
  onRegister,
  loading,
  error,
  onClearError,
}: AuthFormProps) => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isRegisterMode) {
      await onRegister(email, password);
    } else {
      await onLogin(email, password);
    }
  };

  const handleInputChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    // Limpa erro quando o usuário começa a corrigir os campos
    if (error) onClearError();
  };

  const toggleMode = () => {
    setIsRegisterMode((prev) => !prev);
    onClearError();
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        {/* Cabeçalho com nome da aplicação */}
        <div className="auth-header">
          <div className="auth-logo">✓</div>
          <h1 className="auth-title">SecureTasks</h1>
          <p className="auth-subtitle">
            {isRegisterMode
              ? 'Crie sua conta para começar'
              : 'Entre para acessar suas tarefas'}
          </p>
        </div>

        {/* Área de erro — aria-live="polite" anuncia o erro para leitores de tela */}
        {error && (
          <div className="auth-error" role="alert" aria-live="polite">
            <span className="auth-error-icon">⚠</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="field-group">
            <label htmlFor="auth-email" className="field-label">
              E-mail
            </label>
            <input
              id="auth-email"
              type="email"
              className="field-input"
              placeholder="seu@email.com"
              value={email}
              onChange={handleInputChange(setEmail)}
              required
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div className="field-group">
            <label htmlFor="auth-password" className="field-label">
              Senha
            </label>
            <input
              id="auth-password"
              type="password"
              className="field-input"
              placeholder="••••••••"
              value={password}
              onChange={handleInputChange(setPassword)}
              required
              autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading || !email || !password}
          >
            {loading ? (
              <span className="btn-loading">
                <span className="spinner" aria-hidden="true" />
                {isRegisterMode ? 'Criando conta…' : 'Entrando…'}
              </span>
            ) : isRegisterMode ? (
              'Criar conta'
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        {/* Toggle login ↔ registro */}
        <div className="auth-toggle">
          <span className="auth-toggle-text">
            {isRegisterMode ? 'Já tem uma conta?' : 'Não tem conta?'}
          </span>
          <button
            type="button"
            className="btn-link"
            onClick={toggleMode}
            disabled={loading}
          >
            {isRegisterMode ? 'Fazer login' : 'Criar conta grátis'}
          </button>
        </div>
      </div>
    </div>
  );
};
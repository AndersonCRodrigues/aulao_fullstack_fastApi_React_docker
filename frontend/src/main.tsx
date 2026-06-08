/**
 * main.tsx
 * ========
 * Ponto de entrada da aplicação React.
 *
 * React.StrictMode:
 *   Ativa verificações extras durante o desenvolvimento (não afeta produção):
 *   - Detecta efeitos colaterais não intencionais (monta componentes duas vezes em dev)
 *   - Avisa sobre uso de APIs obsoletas
 *   - Garante que referências de estado são atualizadas corretamente
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Monta a aplicação no elemento <div id="root"> do index.html
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
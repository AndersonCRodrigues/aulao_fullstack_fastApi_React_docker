import type { Task } from '../types/Task';

const BASE_URL = import.meta.env.VITE_API_URL;

const authFetch = async (url: string, options: RequestInit = {}) => {
  const accessToken = localStorage.getItem('access_token');

  options.headers = {
    ...options.headers,
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  let res = await fetch(url, options);

  if (res.status === 401) {
    const refreshToken = localStorage.getItem('refresh_token');

    const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    });

    if (refreshRes.ok) {
      const data = await refreshRes.json();
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);

      // Retenta a requisição original com o novo token
      options.headers = { ...options.headers, 'Authorization': `Bearer ${data.access_token}` };
      res = await fetch(url, options);
    } else {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/';
      throw new Error('Sessão expirada');
    }
  }
  return res;
};

export const api = {
  login: async (email: string, password: string) => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('Falha no login');
    const data = await res.json();
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    return data;
  },

  getTasks: async (search: string = ''): Promise<Task[]> => {
    const res = await authFetch(`${BASE_URL}/tasks/${search ? `?q=${search}` : ''}`);
    return res.json();
  },

  createTask: async (title: string, content: string) => {
    await authFetch(`${BASE_URL}/tasks/`, {
      method: 'POST',
      body: JSON.stringify({ title, content }),
    });
  },

  updateTask: async (id: string, updates: { title?: string; completed?: boolean }) => {
    await authFetch(`${BASE_URL}/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  deleteTask: async (id: string) => {
    const res = await authFetch(`${BASE_URL}/tasks/${id}`, { method: 'DELETE' });
    return res.ok;
  }
};
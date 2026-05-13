import { useContext, useCallback } from 'react';
import { AuthContext } from '../auth/AuthContext';

const API_BASE = '/api';

export function useApi() {
  const { token, logout } = useContext(AuthContext);

  const request = useCallback(async (path, { method = 'GET', body, headers = {} } = {}) => {
    const finalHeaders = { 'Content-Type': 'application/json', ...headers };
    if (token) finalHeaders['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
      logout();
      throw new Error('Session expired');
    }

    if (!res.ok) {
      let detail = res.statusText;
      try {
        const data = await res.json();
        detail = data.error || data.detail || detail;
      } catch {}
      const err = new Error(`${res.status} ${detail}`);
      err.status = res.status;
      throw err;
    }

    if (res.status === 204) return null;
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
  }, [token, logout]);

  return {
    get: (path) => request(path),
    post: (path, body) => request(path, { method: 'POST', body }),
    put: (path, body) => request(path, { method: 'PUT', body }),
    patch: (path, body) => request(path, { method: 'PATCH', body }),
    del: (path) => request(path, { method: 'DELETE' }),
  };
}

export function toast(msg, kind = '') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast visible ${kind}`;
  setTimeout(() => { el.className = 'toast'; }, 2400);
}
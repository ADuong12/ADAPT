import { createContext, useState, useCallback } from 'react';

export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

import { useContext } from 'react';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('authToken');
    if (!token) return null;
    return {
      token,
      teacherId: Number(localStorage.getItem('teacherId')),
      role: localStorage.getItem('teacherRole') || 'teacher',
      name: localStorage.getItem('teacherName') || 'Teacher',
    };
  });

  const login = useCallback(async (data) => {
    localStorage.setItem('authToken', data.accessToken);
    localStorage.setItem('teacherId', String(data.user.teacher_id));
    localStorage.setItem('teacherRole', data.user.role);

    // Fetch full profile for name
    let userName = 'Teacher';
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${data.accessToken}` },
      });
      if (res.ok) {
        const profile = await res.json();
        userName = `${profile.first_name} ${profile.last_name}`;
        localStorage.setItem('teacherName', userName);
      }
    } catch {}

    setUser({
      token: data.accessToken,
      teacherId: data.user.teacher_id,
      role: data.user.role,
      name: userName,
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.clear();
    setUser(null);
  }, []);

  const token = user?.token || null;

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
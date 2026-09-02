import { useState, useEffect, type ReactNode } from 'react';
import { apiFetch } from './api-client';
import { authResponseSchema, type AuthResponse } from '@scheduler/contracts';
import { AuthContext } from './auth-context';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthResponse['user'] | null>(() => {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));

  useEffect(() => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }, [token, user]);

  const login = async (email: string, password: string) => {
    const response = await apiFetch('/api/auth/login', authResponseSchema, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(response.accessToken);
    setUser(response.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const response = await apiFetch('/api/auth/register', authResponseSchema, {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    setToken(response.accessToken);
    setUser(response.user);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        register,
        logout,
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

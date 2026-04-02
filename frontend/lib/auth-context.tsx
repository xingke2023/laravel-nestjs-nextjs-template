'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from './api';
import { configureClient } from './api/client';
import type { User, LoginCredentials, RegisterCredentials, AuthResponse } from './api';

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  setTokens: (data: { accessToken: string; refreshToken: string; user?: User }) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function setTokens(data: { accessToken: string; refreshToken: string; user?: User }) {
    setAccessToken(data.accessToken);
    if (data.user) setUser(data.user);
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
  }

  function clear() {
    setAccessToken(null);
    setUser(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  useEffect(() => {
    configureClient({
      onTokenRefreshed: (at, rt) => {
        setAccessToken(at);
        localStorage.setItem('accessToken', at);
        localStorage.setItem('refreshToken', rt);
      },
      onUnauthorized: () => {
        clear();
        window.location.href = '/login';
      },
    });

    const storedToken = localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
      setAccessToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (credentials: LoginCredentials) => {
    const res = await authApi.login(credentials);
    setTokens(res);
  };

  const register = async (credentials: RegisterCredentials) => {
    const res = await authApi.register(credentials);
    setTokens(res);
  };

  const logout = async () => {
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
    if (refreshToken) {
      await authApi.logout(refreshToken).catch(() => {});
    }
    clear();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        loading,
        login,
        register,
        logout,
        setTokens,
        isAuthenticated: !!accessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, getToken, LOGOUT_EVENT, setToken, type AuthUser } from '@/lib/api';

interface AuthValue {
  user: AuthUser | null;
  loading: boolean;
  login: (phone: string, pin: string) => Promise<void>;
  register: (phone: string, name: string, pin: string) => Promise<void>;
  logout: () => void;
  /** Re-read the profile (balance) from the server. */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

interface AuthResponse {
  token: string;
  user: AuthUser;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(() => getToken() !== null);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) return;
    try {
      setUser(await api.get<AuthUser>('/api/me'));
    } catch {
      /* a 401 triggers LOGOUT_EVENT; other errors keep the last known profile */
    }
  }, []);

  useEffect(() => {
    if (getToken()) void refresh().finally(() => setLoading(false));
    const onLogout = () => logout();
    window.addEventListener(LOGOUT_EVENT, onLogout);
    return () => window.removeEventListener(LOGOUT_EVENT, onLogout);
  }, [refresh, logout]);

  const login = useCallback(async (phone: string, pin: string) => {
    const r = await api.post<AuthResponse>('/api/auth/login', { phone, pin });
    setToken(r.token);
    setUser(r.user);
  }, []);

  const register = useCallback(async (phone: string, name: string, pin: string) => {
    const r = await api.post<AuthResponse>('/api/auth/register', { phone, name, pin });
    setToken(r.token);
    setUser(r.user);
  }, []);

  const value = useMemo<AuthValue>(() => ({ user, loading, login, register, logout, refresh }), [user, loading, login, register, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}

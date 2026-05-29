import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getToken, login as apiLogin, setToken } from '../api/client';

interface AuthContextValue {
  isAuthenticated: boolean;
  username: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(() =>
    getToken() ? 'admin' : null,
  );

  const logout = useCallback(() => {
    setToken(null);
    setUsername(null);
  }, []);

  const login = useCallback(async (user: string, password: string) => {
    const res = await apiLogin(user, password);
    setToken(res.token);
    setUsername(res.user.username);
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(getToken()),
      username,
      login,
      logout,
    }),
    [username, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import api from "../api/client";
import type { UserInfo } from "../types";

interface AuthContextValue {
  user: UserInfo | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>): JSX.Element {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await api.get<UserInfo>("/auth/me");
        setUser(data);
      } catch {
        localStorage.removeItem("access_token");
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, []);

  const login = async (username: string, password: string) => {
    const tokenResponse = await api.post<{ access_token: string }>("/auth/login", { username, password });
    localStorage.setItem("access_token", tokenResponse.data.access_token);

    const meResponse = await api.get<UserInfo>("/auth/me");
    setUser(meResponse.data);
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}

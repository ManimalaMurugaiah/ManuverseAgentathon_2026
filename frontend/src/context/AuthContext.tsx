import { createContext, useContext, useEffect, useMemo, useState } from "react";

import api from "../api/client";
import type { UserInfo } from "../types";

interface AuthContextValue {
  user: UserInfo | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
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
        localStorage.removeItem("refresh_token");
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, []);

  const login = async (username: string, password: string) => {
    const tokenResponse = await api.post<{ access_token: string; refresh_token: string }>("/auth/login", { username, password });
    localStorage.setItem("access_token", tokenResponse.data.access_token);
    localStorage.setItem("refresh_token", tokenResponse.data.refresh_token);

    const meResponse = await api.get<UserInfo>("/auth/me");
    setUser(meResponse.data);
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem("refresh_token");
    try {
      await api.post("/auth/logout");
      if (refreshToken) {
        await api.post("/auth/logout-refresh", { refresh_token: refreshToken });
      }
    } catch {
      // Always clear local auth state even if backend revoke call fails.
    }
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
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

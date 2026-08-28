import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, clearToken, saveToken, type User } from "@/src/api";
import { useI18n } from "@/src/i18n";

type AuthCtx = {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: User) => void;
};

const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const { setLang } = useI18n();

  const applyUser = useCallback(
    (u: User | null) => {
      setUserState(u);
      if (u?.language) setLang(u.language);
    },
    [setLang],
  );

  const refresh = useCallback(async () => {
    try {
      const u = await api.me();
      applyUser(u);
    } catch {
      applyUser(null);
      await clearToken();
    }
  }, [applyUser]);

  useEffect(() => {
    (async () => {
      await refresh();
      setReady(true);
    })();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { token, user } = await api.login(email, password);
      await saveToken(token);
      applyUser(user);
      return user;
    },
    [applyUser],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const { token, user } = await api.register(name, email, password);
      await saveToken(token);
      applyUser(user);
      return user;
    },
    [applyUser],
  );

  const logout = useCallback(async () => {
    await clearToken();
    setUserState(null);
  }, []);

  return (
    <Ctx.Provider value={{ user, ready, login, register, logout, refresh, setUser: applyUser }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}

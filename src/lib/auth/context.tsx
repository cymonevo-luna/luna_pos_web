"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { authApi, type LoginPayload, type RegisterPayload } from "@/lib/api/auth";
import { usersApi } from "@/lib/api/users";
import { refreshTokenPair } from "@/lib/auth/refresh";
import {
  isClaimsValid,
  needsTokenRefresh,
} from "@/lib/auth/session";
import { tokenStore, decodeJwt } from "@/lib/auth/tokens";
import type { User } from "@/lib/api/types";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hydrate = useCallback(async () => {
    let access = tokenStore.access;
    const refresh = tokenStore.refresh;

    if (needsTokenRefresh(access, refresh)) {
      if (!refresh) {
        tokenStore.clear();
        setUser(null);
        setIsLoading(false);
        return;
      }
      const tokens = await refreshTokenPair(refresh);
      if (!tokens) {
        tokenStore.clear();
        setUser(null);
        setIsLoading(false);
        return;
      }
      tokenStore.set(tokens.access_token, tokens.refresh_token);
      access = tokens.access_token;
    }

    const claims = access ? decodeJwt(access) : null;
    if (!isClaimsValid(claims) || !claims) {
      tokenStore.clear();
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const { data } = await usersApi.get(claims.uid);
      setUser(data);
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const login = useCallback(async (payload: LoginPayload) => {
    const { data } = await authApi.login(payload);
    tokenStore.set(data.tokens.access_token, data.tokens.refresh_token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    await authApi.register(payload);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!user) return;
    const { data } = await usersApi.get(user.id);
    setUser(data);
  }, [user]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      isAdmin: user?.role === "admin",
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, isLoading, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

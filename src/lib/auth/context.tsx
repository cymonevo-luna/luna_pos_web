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
import {
  merchantsApi,
  type MerchantRegisterPayload,
} from "@/lib/api/merchants";
import { usersApi } from "@/lib/api/users";
import { refreshTokenPair } from "@/lib/auth/refresh";
import { hasMerchantAreaAccess } from "@/lib/auth/roles";
import { isClaimsValid } from "@/lib/auth/session";
import { mergeSessionFeatures, subscribeSessionUser } from "@/lib/auth/session-features";
import { setBrowserFeaturesCookie } from "@/lib/auth/cookies";
import { clearAuthSession, sessionStore } from "@/lib/auth/session-store";
import { tokenStore, decodeJwt } from "@/lib/auth/tokens";
import type { SessionMerchant, User } from "@/lib/api/types";

interface AuthState {
  user: User | null;
  merchant: SessionMerchant | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<void>;
  registerMerchant: (payload: MerchantRegisterPayload) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

function persistSession(user: User, merchant: SessionMerchant) {
  sessionStore.set({ user, merchant });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [merchant, setMerchant] = useState<SessionMerchant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hydrate = useCallback(async () => {
    const access = tokenStore.access;
    const refresh = tokenStore.refresh;
    const accessValid = tokenStore.isAccessValid();
    const refreshValid = tokenStore.isRefreshValid();

    if (!access && !refresh) {
      setUser(null);
      setMerchant(null);
      setIsLoading(false);
      return;
    }

    if (!accessValid && !refreshValid) {
      clearAuthSession();
      setUser(null);
      setMerchant(null);
      setIsLoading(false);
      return;
    }

    let featuresSyncedFromRefresh = false;

    let currentAccess = access;
    if (!accessValid && refreshValid && refresh) {
      const result = await refreshTokenPair(refresh);
      if (!result) {
        clearAuthSession();
        setUser(null);
        setMerchant(null);
        setIsLoading(false);
        return;
      }
      tokenStore.setFromPair(result.tokens);
      currentAccess = result.tokens.access_token;
      if (result.features) {
        mergeSessionFeatures(result.features);
        featuresSyncedFromRefresh = true;
      }
    }

    const claims = currentAccess ? decodeJwt(currentAccess) : null;
    if (!isClaimsValid(claims) || !claims) {
      clearAuthSession();
      setUser(null);
      setMerchant(null);
      setIsLoading(false);
      return;
    }

    const stored = sessionStore.get();
    if (
      stored &&
      stored.user.id === claims.uid &&
      stored.user.merchant_id === claims.merchant_id
    ) {
      const hasStoredFeatures =
        Array.isArray(stored.user.features) && stored.user.features.length > 0;

      if (!featuresSyncedFromRefresh && !hasStoredFeatures) {
        try {
          const { data } = await usersApi.get(claims.uid);
          const user = { ...stored.user, features: data.features };
          persistSession(user, stored.merchant);
          setUser(user);
        } catch {
          setUser(stored.user);
        }
      } else {
        const refreshed = sessionStore.get();
        setUser(refreshed?.user ?? stored.user);
      }
      setMerchant(stored.merchant);
      setIsLoading(false);
      return;
    }

    try {
      const { data } = await usersApi.get(claims.uid);
      const sessionMerchant =
        stored?.merchant?.id === claims.merchant_id
          ? stored.merchant
          : { id: claims.merchant_id, name: stored?.merchant?.name ?? "" };
      persistSession(data, sessionMerchant);
      setUser(data);
      setMerchant(sessionMerchant);
    } catch {
      clearAuthSession();
      setUser(null);
      setMerchant(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    return subscribeSessionUser((updatedUser) => {
      setUser(updatedUser);
    });
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const { data } = await authApi.login(payload);
    tokenStore.setFromPair(data.tokens);
    persistSession(data.user, data.merchant);
    if (Array.isArray(data.user.features)) {
      setBrowserFeaturesCookie(data.user.features);
    }
    setUser(data.user);
    setMerchant(data.merchant);
    return data.user;
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    await authApi.register(payload);
  }, []);

  const registerMerchant = useCallback(async (payload: MerchantRegisterPayload) => {
    const { data } = await merchantsApi.register(payload);
    tokenStore.setFromPair(data.tokens);
    const sessionMerchant = { id: data.merchant.id, name: data.merchant.name };
    persistSession(data.user, sessionMerchant);
    if (Array.isArray(data.user.features)) {
      setBrowserFeaturesCookie(data.user.features);
    }
    setUser(data.user);
    setMerchant(sessionMerchant);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    clearAuthSession();
    setUser(null);
    setMerchant(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!user || !merchant) return;
    const { data } = await usersApi.get(user.id);
    persistSession(data, merchant);
    setUser(data);
  }, [user, merchant]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      merchant,
      isLoading,
      isAuthenticated: !!user,
      isAdmin: hasMerchantAreaAccess(user),
      login,
      register,
      registerMerchant,
      logout,
      refreshUser,
    }),
    [user, merchant, isLoading, login, register, registerMerchant, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

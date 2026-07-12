import { config } from "@/lib/config";
import { tokenStore } from "@/lib/auth/tokens";
import type { SessionMerchant, User } from "@/lib/api/types";

export interface AuthSession {
  user: User;
  merchant: SessionMerchant;
}

const isBrowser = () => typeof window !== "undefined";

function readJson<T>(key: string): T | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (!isBrowser()) return;
  localStorage.setItem(key, JSON.stringify(value));
}

function removeKey(key: string) {
  if (!isBrowser()) return;
  localStorage.removeItem(key);
}

export const sessionStore = {
  get(): AuthSession | null {
    const user = readJson<User>(config.session.user);
    const merchant = readJson<SessionMerchant>(config.session.merchant);
    if (!user || !merchant) return null;
    return { user, merchant };
  },

  set(session: AuthSession) {
    writeJson(config.session.user, session.user);
    writeJson(config.session.merchant, session.merchant);
  },

  clear() {
    removeKey(config.session.user);
    removeKey(config.session.merchant);
  },
};

/** Clears token cookies and persisted user/merchant session state. */
export function clearAuthSession() {
  tokenStore.clear();
  sessionStore.clear();
}

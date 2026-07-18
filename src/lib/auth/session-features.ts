import type { User } from "@/lib/api/types";
import { setBrowserFeaturesCookie } from "@/lib/auth/cookies";
import { sessionStore } from "@/lib/auth/session-store";

type SessionUserListener = (user: User) => void;

const listeners = new Set<SessionUserListener>();

/** Subscribe to session user updates triggered outside React (e.g. token refresh). */
export function subscribeSessionUser(listener: SessionUserListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifySessionUser(user: User) {
  for (const listener of listeners) {
    listener(user);
  }
}

/** Merge API feature grants into the persisted session user and notify subscribers. */
export function mergeSessionFeatures(features: string[]): User | null {
  const stored = sessionStore.get();
  if (!stored) return null;

  const user: User = { ...stored.user, features };
  sessionStore.set({ user, merchant: stored.merchant });
  setBrowserFeaturesCookie(features);
  notifySessionUser(user);
  return user;
}

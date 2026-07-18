import { describe, it, expect, beforeEach } from "vitest";
import { config } from "@/lib/config";
import { sessionStore, clearAuthSession } from "./session-store";
import { tokenStore } from "./tokens";
import type { User } from "@/lib/api/types";

const sampleUser: User = {
  id: "user-1",
  email: "owner@example.com",
  name: "Owner",
  roles: ["admin", "manager"],
  merchant_id: "merchant-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("sessionStore", () => {
  beforeEach(() => {
    clearAuthSession();
  });

  it("persists user and merchant in localStorage", () => {
    sessionStore.set({
      user: sampleUser,
      merchant: { id: "merchant-1", name: "Luna Cafe" },
    });

    const stored = sessionStore.get();
    expect(stored?.user.roles).toEqual(["admin", "manager"]);
    expect(stored?.user.merchant_id).toBe("merchant-1");
    expect(stored?.merchant.name).toBe("Luna Cafe");
    expect(localStorage.getItem(config.session.user)).toContain("merchant-1");
  });

  it("clears persisted session state", () => {
    sessionStore.set({
      user: sampleUser,
      merchant: { id: "merchant-1", name: "Luna Cafe" },
    });
    sessionStore.clear();
    expect(sessionStore.get()).toBeNull();
    expect(localStorage.getItem(config.session.user)).toBeNull();
  });
});

describe("clearAuthSession", () => {
  beforeEach(() => {
    clearAuthSession();
  });

  it("clears tokens and persisted session state", () => {
    tokenStore.set("access", "refresh");
    sessionStore.set({
      user: sampleUser,
      merchant: { id: "merchant-1", name: "Luna Cafe" },
    });

    clearAuthSession();

    expect(tokenStore.access).toBeNull();
    expect(tokenStore.refresh).toBeNull();
    expect(localStorage.getItem(config.tokens.accessExpiresAt)).toBeNull();
    expect(localStorage.getItem(config.tokens.refreshExpiresAt)).toBeNull();
    expect(sessionStore.get()).toBeNull();
    expect(document.cookie).not.toContain(`${config.cookies.features}=`);
  });
});

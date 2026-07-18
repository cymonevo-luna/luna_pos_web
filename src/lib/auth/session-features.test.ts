import { describe, it, expect, vi, beforeEach } from "vitest";
import { config } from "@/lib/config";
import { mergeSessionFeatures, subscribeSessionUser } from "./session-features";
import { sessionStore } from "./session-store";
import type { User } from "@/lib/api/types";

const cashierUser: User = {
  id: "cashier-1",
  email: "cashier-test@cymonevo.com",
  name: "Cashier",
  roles: ["cashier"],
  features: [],
  merchant_id: "merchant-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("session-features", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStore.set({
      user: cashierUser,
      merchant: { id: "merchant-1", name: "Test Merchant" },
    });
  });

  it("mergeSessionFeatures updates persisted user features", () => {
    const updated = mergeSessionFeatures(["menus.manage"]);
    expect(updated?.features).toEqual(["menus.manage"]);

    const stored = sessionStore.get();
    expect(stored?.user.features).toEqual(["menus.manage"]);
    expect(
      JSON.parse(localStorage.getItem(config.session.user) ?? "{}").features,
    ).toEqual(["menus.manage"]);
  });

  it("mergeSessionFeatures notifies subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSessionUser(listener);

    mergeSessionFeatures(["menus.manage"]);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ features: ["menus.manage"] }),
    );

    unsubscribe();
  });
});

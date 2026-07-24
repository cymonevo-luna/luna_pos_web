import { describe, it, expect } from "vitest";
import { resolveUserFeatures } from "./features";

describe("resolveUserFeatures", () => {
  it("honors an explicit empty features array from the API", () => {
    expect(
      resolveUserFeatures({
        roles: ["cashier"],
        features: [],
      }),
    ).toEqual([]);
  });

  it("uses API features when provided", () => {
    expect(
      resolveUserFeatures({
        roles: ["cashier"],
        features: ["menus.manage"],
      }),
    ).toEqual(["menus.manage"]);
  });

  it("falls back to legacy role grants when features is unavailable", () => {
    expect(
      resolveUserFeatures({
        roles: ["manager"],
      }),
    ).toContain("menus.manage");
  });

  it("returns empty legacy fallback for cook role", () => {
    expect(
      resolveUserFeatures({
        roles: ["cook"],
        features: undefined,
      }),
    ).toEqual([]);
  });
});

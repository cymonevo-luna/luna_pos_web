import { describe, expect, it } from "vitest";
import {
  buildUnauthorizedRedirectUrl,
  getUnauthorizedRedirectTarget,
  parseUnauthorizedAccessContext,
  resolveRouteLabel,
  shouldShowStaleSessionHint,
} from "./unauthorized-access";
import { sourceWithFeatures } from "./feature-fixtures";

describe("unauthorized-access", () => {
  it("builds redirect URLs with attempted path, feature, and label", () => {
    const url = buildUnauthorizedRedirectUrl("/admin/menus");
    expect(url).toContain("/admin/unauthorized?");
    expect(url).toContain("from=%2Fadmin%2Fmenus");
    expect(url).toContain("feature=menus.manage");
    expect(url).toContain("label=Menu");
  });

  it("builds redirect URLs for categories", () => {
    const url = buildUnauthorizedRedirectUrl("/admin/categories");
    expect(url).toContain("feature=categories.manage");
    expect(url).toContain("label=Categories");
  });

  it("parses unauthorized context from search params", () => {
    const params = new URLSearchParams({
      from: "/admin/menus",
      feature: "menus.manage",
      label: "Menu",
    });

    expect(parseUnauthorizedAccessContext(params)).toEqual({
      attemptedPath: "/admin/menus",
      requiredFeature: "menus.manage",
      routeLabel: "Menu",
    });
  });

  it("resolves route labels from the registry", () => {
    expect(resolveRouteLabel("/admin/menus")).toBe("Menu");
    expect(resolveRouteLabel("/admin/categories")).toBe("Categories");
    expect(resolveRouteLabel("/admin/menus/menu-1")).toBe("Menu");
  });

  it("redirects merchant-area users to contextual unauthorized URLs", () => {
    const operational = sourceWithFeatures(["operational"]);
    expect(getUnauthorizedRedirectTarget("/admin/menus", operational)).toContain(
      "feature=menus.manage",
    );
  });

  it("redirects cashier-only users to the dashboard", () => {
    const cashier = sourceWithFeatures(["cashier"]);
    expect(getUnauthorizedRedirectTarget("/admin/menus", cashier)).toBe(
      "/dashboard",
    );
  });

  it("detects stale sessions when a fresh refresh includes the required feature", () => {
    expect(
      shouldShowStaleSessionHint("menus.manage", ["transactions.view"], [
        "transactions.view",
        "menus.manage",
      ]),
    ).toBe(true);
  });

  it("does not show stale-session hints when the session already has the feature", () => {
    expect(
      shouldShowStaleSessionHint("menus.manage", ["menus.manage"], [
        "menus.manage",
      ]),
    ).toBe(false);
  });
});

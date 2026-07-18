import { describe, it, expect } from "vitest";
import { parseFeaturesCookie } from "./cookies";

describe("parseFeaturesCookie", () => {
  it("returns undefined for missing or invalid values", () => {
    expect(parseFeaturesCookie(undefined)).toBeUndefined();
    expect(parseFeaturesCookie("")).toBeUndefined();
    expect(parseFeaturesCookie("not-json")).toBeUndefined();
    expect(parseFeaturesCookie("{}")).toBeUndefined();
    expect(parseFeaturesCookie("[1, 2]")).toBeUndefined();
  });

  it("parses a JSON string array of feature keys", () => {
    expect(parseFeaturesCookie('["menus.manage","pos.menu"]')).toEqual([
      "menus.manage",
      "pos.menu",
    ]);
  });
});

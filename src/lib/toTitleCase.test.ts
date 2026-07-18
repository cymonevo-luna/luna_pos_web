import { describe, it, expect } from "vitest";
import { toTitleCase } from "./toTitleCase";

describe("toTitleCase", () => {
  it("title-cases lowercase multi-word input", () => {
    expect(toTitleCase("es teh manis")).toBe("Es Teh Manis");
  });

  it("trims and collapses internal whitespace", () => {
    expect(toTitleCase("  premium   rice  ")).toBe("Premium Rice");
    expect(toTitleCase("  hello   world  ")).toBe("Hello World");
  });

  it("returns an empty string for empty input", () => {
    expect(toTitleCase("")).toBe("");
    expect(toTitleCase("   ")).toBe("");
  });
});

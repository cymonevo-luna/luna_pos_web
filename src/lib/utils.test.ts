import { describe, it, expect } from "vitest";
import { cn, formatDate, initials } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("resolves conflicting tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("handles conditional values", () => {
    expect(cn("a", false && "b", null, undefined, "c")).toBe("a c");
  });
});

describe("formatDate", () => {
  it("formats an ISO string", () => {
    expect(formatDate("2024-01-15T00:00:00Z")).toMatch(/2024/);
  });

  it("returns a dash for invalid input", () => {
    expect(formatDate("not-a-date")).toBe("—");
  });
});

describe("initials", () => {
  it("returns up to two uppercase initials", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
  });

  it("handles a single name", () => {
    expect(initials("Madonna")).toBe("M");
  });

  it("ignores extra words", () => {
    expect(initials("John Ronald Reuel Tolkien")).toBe("JR");
  });
});

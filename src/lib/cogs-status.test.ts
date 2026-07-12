import { describe, it, expect } from "vitest";
import {
  COGS_STATUS_LABELS,
  cogsStatusBadgeClass,
  cogsStatusRowClass,
} from "./cogs-status";

describe("cogs-status", () => {
  it("maps status labels", () => {
    expect(COGS_STATUS_LABELS.complete).toBe("Complete");
    expect(COGS_STATUS_LABELS.missing_prices).toBe("Missing prices");
    expect(COGS_STATUS_LABELS.no_formula).toBe("No formula");
  });

  it("returns badge classes for each status", () => {
    expect(cogsStatusBadgeClass("complete")).toContain("bg-success");
    expect(cogsStatusBadgeClass("missing_prices")).toContain("bg-amber-500");
    expect(cogsStatusBadgeClass("no_formula")).toContain("bg-secondary");
  });

  it("returns row tint classes for each status", () => {
    expect(cogsStatusRowClass("complete")).toContain("bg-success/5");
    expect(cogsStatusRowClass("missing_prices")).toContain("bg-amber-500/10");
    expect(cogsStatusRowClass("no_formula")).toContain("bg-muted/40");
  });
});

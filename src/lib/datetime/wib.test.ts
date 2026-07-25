import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defaultReportRange,
  endOfDayWIB,
  formatWIB,
  nowWIB,
  startOfDayWIB,
  todayWIB,
  toApiDateParam,
} from "./wib";

afterEach(() => {
  vi.useRealTimers();
});

describe("todayWIB", () => {
  it("returns 2026-07-25 at 2026-07-24T18:00:00Z (past WIB midnight)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-24T18:00:00Z"));

    expect(todayWIB()).toBe("2026-07-25");
  });

  it("returns 2026-07-24 at 2026-07-24T16:59:59Z (still previous WIB day)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-24T16:59:59Z"));

    expect(todayWIB()).toBe("2026-07-24");
  });

  it("returns 2026-07-25 at 2026-07-24T17:00:00Z (WIB midnight boundary)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-24T17:00:00Z"));

    expect(todayWIB()).toBe("2026-07-25");
  });
});

describe("toApiDateParam", () => {
  it("formats an instant using WIB calendar day, not UTC", () => {
    expect(toApiDateParam(new Date("2026-07-24T18:00:00Z"))).toBe("2026-07-25");
  });

  it("passes through YYYY-MM-DD date-only strings unchanged", () => {
    expect(toApiDateParam("2026-07-25")).toBe("2026-07-25");
  });

  it("does not use UTC ISO date slicing", () => {
    const utcSlice = new Date("2026-07-24T18:00:00Z").toISOString().slice(0, 10);
    expect(utcSlice).toBe("2026-07-24");
    expect(toApiDateParam(new Date("2026-07-24T18:00:00Z"))).toBe("2026-07-25");
  });
});

describe("startOfDayWIB and endOfDayWIB", () => {
  it("maps WIB midnight to 17:00 UTC on the previous calendar day", () => {
    expect(startOfDayWIB("2026-07-25").toISOString()).toBe(
      "2026-07-24T17:00:00.000Z",
    );
  });

  it("maps WIB end of day to 16:59:59.999 UTC on the same UTC calendar day", () => {
    expect(endOfDayWIB("2026-07-25").toISOString()).toBe(
      "2026-07-25T16:59:59.999Z",
    );
  });
});

describe("defaultReportRange", () => {
  it("returns last 30 WIB days through today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-24T18:00:00Z"));

    expect(defaultReportRange()).toEqual({
      dateFrom: "2026-06-25",
      dateTo: "2026-07-25",
    });
  });
});

describe("formatWIB", () => {
  it("formats using the WIB timezone", () => {
    expect(formatWIB("2026-07-24T18:00:00Z", "date")).toMatch(/Jul 25, 2026/);
  });

  it("returns an em dash for invalid input", () => {
    expect(formatWIB("not-a-date", "date")).toBe("—");
  });
});

describe("nowWIB", () => {
  it("returns the current instant", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-24T18:00:00Z"));

    expect(nowWIB().toISOString()).toBe("2026-07-24T18:00:00.000Z");
  });
});

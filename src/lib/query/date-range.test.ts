import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appendHistoryDateParams,
  getPresetDateRange,
  getTodayDateInput,
} from "./date-range";

afterEach(() => {
  vi.useRealTimers();
});

describe("getPresetDateRange", () => {
  it("returns today in WIB for the today preset", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-24T18:00:00Z"));

    expect(getPresetDateRange("today")).toEqual({
      dateFrom: "2026-07-25",
      dateTo: "2026-07-25",
    });
  });

  it("returns Monday through today for the week preset", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-24T18:00:00Z"));

    expect(getPresetDateRange("week")).toEqual({
      dateFrom: "2026-07-20",
      dateTo: "2026-07-25",
    });
  });

  it("returns month start through today for the month preset", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-24T18:00:00Z"));

    expect(getPresetDateRange("month")).toEqual({
      dateFrom: "2026-07-01",
      dateTo: "2026-07-25",
    });
  });
});

describe("appendHistoryDateParams", () => {
  it("serializes bounds as WIB YYYY-MM-DD strings", () => {
    const params = new URLSearchParams();
    appendHistoryDateParams(params, "2026-07-25", "2026-07-25");

    expect(params.get("date_from")).toBe("2026-07-25");
    expect(params.get("date_to")).toBe("2026-07-25");
  });
});

describe("getTodayDateInput", () => {
  it("delegates to todayWIB", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-24T18:00:00Z"));

    expect(getTodayDateInput()).toBe("2026-07-25");
  });
});

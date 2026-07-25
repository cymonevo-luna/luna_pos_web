import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defaultReportRange,
  endOfDayWIB,
  formatPeriodStartLabel,
  formatWIB,
  maxWibDatetimeLocalInput,
  nowWIB,
  startOfDayWIB,
  startOfMonthWIB,
  startOfWeekWIB,
  todayWIB,
  toApiDateParam,
  toWibDatetimeLocalInput,
  wibDatetimeLocalInputToIso,
  withWibPeriodLabels,
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

describe("formatPeriodStartLabel", () => {
  it("labels WIB midnight boundary as the next calendar day", () => {
    expect(formatPeriodStartLabel("2026-07-24T17:00:00.000Z", "daily")).toBe(
      "Jul 25",
    );
  });

  it("formats monthly buckets with month and year in WIB", () => {
    expect(formatPeriodStartLabel("2026-07-24T17:00:00.000Z", "monthly")).toBe(
      "Jul 2026",
    );
  });
});

describe("withWibPeriodLabels", () => {
  it("replaces period_label using period_start in WIB", () => {
    expect(
      withWibPeriodLabels(
        [
          {
            period_start: "2026-07-24T17:00:00.000Z",
            period_label: "Jul 24",
            count: 1,
          },
        ],
        "daily",
      ),
    ).toEqual([
      {
        period_start: "2026-07-24T17:00:00.000Z",
        period_label: "Jul 25",
        count: 1,
      },
    ]);
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

describe("startOfWeekWIB and startOfMonthWIB", () => {
  it("returns Monday of the WIB week containing the date", () => {
    expect(startOfWeekWIB("2026-07-25")).toBe("2026-07-20");
  });

  it("returns the first day of the WIB month", () => {
    expect(startOfMonthWIB("2026-07-25")).toBe("2026-07-01");
  });
});

describe("WIB datetime-local helpers", () => {
  it("formats an instant for datetime-local in WIB", () => {
    expect(toWibDatetimeLocalInput("2026-07-24T18:00:00Z")).toBe(
      "2026-07-25T01:00",
    );
  });

  it("parses a WIB datetime-local value to UTC ISO", () => {
    expect(wibDatetimeLocalInputToIso("2026-07-25T01:00")).toBe(
      "2026-07-24T18:00:00.000Z",
    );
  });

  it("returns end of WIB today for max datetime-local", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-24T18:00:00Z"));

    expect(maxWibDatetimeLocalInput()).toBe("2026-07-25T23:59");
  });
});

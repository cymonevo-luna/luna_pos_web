import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  HistoryDateRangeFilter,
  type HistoryDateRangeValue,
} from "./history-date-range-filter";
import * as wib from "@/lib/datetime/wib";

afterEach(() => {
  vi.restoreAllMocks();
});

const INITIAL_VALUE: HistoryDateRangeValue = {
  preset: "all",
  dateFrom: "",
  dateTo: "",
};

describe("HistoryDateRangeFilter", () => {
  it("applies the Today preset using WIB calendar day", async () => {
    vi.spyOn(wib, "todayWIB").mockReturnValue("2026-07-25");
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<HistoryDateRangeFilter value={INITIAL_VALUE} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText("Date range"), "today");

    expect(onChange).toHaveBeenCalledWith({
      preset: "today",
      dateFrom: "2026-07-25",
      dateTo: "2026-07-25",
    });
  });

  it("shows custom date inputs only for the custom preset", async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <HistoryDateRangeFilter value={INITIAL_VALUE} onChange={() => {}} />,
    );

    expect(screen.queryByLabelText("Date from")).not.toBeInTheDocument();

    rerender(
      <HistoryDateRangeFilter
        value={{ preset: "custom", dateFrom: "", dateTo: "" }}
        onChange={() => {}}
      />,
    );

    expect(screen.getByLabelText("Date from")).toBeInTheDocument();
    expect(screen.getByLabelText("Date to")).toBeInTheDocument();
  });

  it("clears bounds when All dates is selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <HistoryDateRangeFilter
        value={{ preset: "today", dateFrom: "2026-07-25", dateTo: "2026-07-25" }}
        onChange={onChange}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Date range"), "all");

    expect(onChange).toHaveBeenCalledWith({
      preset: "all",
      dateFrom: "",
      dateTo: "",
    });
  });
});

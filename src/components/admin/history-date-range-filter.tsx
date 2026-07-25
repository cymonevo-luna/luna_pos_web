"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  DATE_RANGE_PRESET_OPTIONS,
  getPresetDateRange,
  getTodayDateInput,
  type DateRangePreset,
} from "@/lib/query/date-range";

export interface HistoryDateRangeValue {
  preset: DateRangePreset;
  dateFrom: string;
  dateTo: string;
}

interface HistoryDateRangeFilterProps {
  value: HistoryDateRangeValue;
  onChange: (value: HistoryDateRangeValue) => void;
  className?: string;
  presetTestId?: string;
  dateFromTestId?: string;
  dateToTestId?: string;
  presetAriaLabel?: string;
  dateFromAriaLabel?: string;
  dateToAriaLabel?: string;
}

export function HistoryDateRangeFilter({
  value,
  onChange,
  className,
  presetTestId = "history-date-preset",
  dateFromTestId = "history-date-from",
  dateToTestId = "history-date-to",
  presetAriaLabel = "Date range",
  dateFromAriaLabel = "Date from",
  dateToAriaLabel = "Date to",
}: HistoryDateRangeFilterProps) {
  const maxDate = useMemo(() => getTodayDateInput(), []);

  const handlePresetChange = (preset: DateRangePreset) => {
    if (preset === "all") {
      onChange({ preset, dateFrom: "", dateTo: "" });
      return;
    }
    if (preset === "custom") {
      onChange({ ...value, preset });
      return;
    }
    const range = getPresetDateRange(preset);
    onChange({ preset, ...range });
  };

  return (
    <div className={className ?? "flex flex-col gap-3 sm:flex-row sm:items-center"}>
      <Select
        aria-label={presetAriaLabel}
        data-testid={presetTestId}
        className="w-full sm:w-44"
        options={DATE_RANGE_PRESET_OPTIONS}
        value={value.preset}
        onChange={(event) =>
          handlePresetChange(event.target.value as DateRangePreset)
        }
      />
      {value.preset === "custom" ? (
        <>
          <Input
            type="date"
            aria-label={dateFromAriaLabel}
            data-testid={dateFromTestId}
            value={value.dateFrom}
            max={maxDate}
            onChange={(event) =>
              onChange({ ...value, dateFrom: event.target.value })
            }
            className="w-full sm:w-40"
          />
          <Input
            type="date"
            aria-label={dateToAriaLabel}
            data-testid={dateToTestId}
            value={value.dateTo}
            max={maxDate}
            onChange={(event) =>
              onChange({ ...value, dateTo: event.target.value })
            }
            className="w-full sm:w-40"
          />
        </>
      ) : null}
    </div>
  );
}

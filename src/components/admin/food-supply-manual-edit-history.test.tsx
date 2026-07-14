import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FoodSupplyManualEditHistory } from "./food-supply-manual-edit-history";
import type { FoodSupplyManualEditHistoryEntry } from "@/lib/api/types";

const history: FoodSupplyManualEditHistoryEntry[] = [
  {
    delta_quantity: "50",
    previous_quantity: "100",
    new_quantity: "150",
    changed_by_username: "ops-user",
    created_at: "2026-03-01T10:00:00Z",
  },
  {
    delta_quantity: "-20",
    previous_quantity: "150",
    new_quantity: "130",
    changed_by_username: "manager-user",
    created_at: "2026-03-02T14:30:00Z",
  },
];

describe("FoodSupplyManualEditHistory", () => {
  it("renders empty state when history is empty", () => {
    render(<FoodSupplyManualEditHistory history={[]} unit="ml" />);

    expect(screen.getByText("Manual edit history")).toBeInTheDocument();
    expect(
      screen.getByText("No manual quantity edits yet"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders history rows oldest-first with signed deltas and unit in header", () => {
    render(<FoodSupplyManualEditHistory history={history} unit="ml" />);

    expect(screen.getByRole("columnheader", { name: "Delta (ml)" })).toBeInTheDocument();
    expect(screen.getByText("+50")).toBeInTheDocument();
    expect(screen.getByText("-20")).toBeInTheDocument();
    expect(screen.getByText("ops-user")).toBeInTheDocument();
    expect(screen.getByText("manager-user")).toBeInTheDocument();

    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("+50");
    expect(rows[2]).toHaveTextContent("-20");
  });
});

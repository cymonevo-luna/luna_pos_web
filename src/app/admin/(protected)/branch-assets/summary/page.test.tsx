import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import BranchAssetsSummaryPage from "./page";

vi.mock("@/components/admin/branch-assets-nav", () => ({
  BranchAssetsNav: () => <div data-testid="branch-assets-nav">Nav</div>,
}));

vi.mock("@/components/admin/branch-assets-summary-section", () => ({
  BranchAssetsSummarySection: () => (
    <div data-testid="branch-assets-summary-section">Summary</div>
  ),
}));

describe("BranchAssetsSummaryPage", () => {
  it("renders summary page shell and section", () => {
    render(<BranchAssetsSummaryPage />);

    expect(screen.getByTestId("branch-assets-summary-page")).toBeInTheDocument();
    expect(screen.getByTestId("branch-assets-nav")).toBeInTheDocument();
    expect(screen.getByTestId("branch-assets-summary-section")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Branch assets summary" }),
    ).toBeInTheDocument();
  });
});

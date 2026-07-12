import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminNewPurchasePage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/components/admin/purchase-request-form", () => ({
  PurchaseRequestForm: ({
    submitLabel,
  }: {
    submitLabel?: string;
  }) => (
    <form aria-label="Purchase request form">
      <button type="submit">{submitLabel ?? "Create purchase request"}</button>
    </form>
  ),
}));

describe("AdminNewPurchasePage", () => {
  it("renders the form and back link", () => {
    render(<AdminNewPurchasePage />);

    expect(
      screen.getByRole("link", { name: /Back to purchases/i }),
    ).toHaveAttribute("href", "/admin/purchases");
    expect(screen.getByRole("heading", { name: "New purchase request" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Purchase request form" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create purchase request" }),
    ).toBeInTheDocument();
  });
});

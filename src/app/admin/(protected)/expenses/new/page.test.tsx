import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminNewExpensePage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/use-expenses", () => ({
  useCreateExpense: () => ({
    mutateAsync: vi.fn().mockResolvedValue({
      data: {
        id: "exp-new",
        transaction_date: "2026-07-01T10:00:00Z",
      },
    }),
    isPending: false,
  }),
}));

vi.mock("@/components/admin/expense-form", () => ({
  ExpenseForm: ({
    submitLabel,
    showTransactionDate,
  }: {
    submitLabel?: string;
    showTransactionDate?: boolean;
  }) => (
    <form aria-label="Expense form">
      {showTransactionDate ? (
        <div data-testid="expense-transaction-date-input" />
      ) : null}
      <button type="submit">{submitLabel ?? "Save"}</button>
    </form>
  ),
}));

describe("AdminNewExpensePage", () => {
  it("renders the form and back link", () => {
    render(<AdminNewExpensePage />);

    expect(
      screen.getByRole("link", { name: /Back to expenses/i }),
    ).toHaveAttribute("href", "/admin/expenses");
    expect(screen.getByRole("heading", { name: "New expense" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Expense form" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create expense" }),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("expense-transaction-date-input"),
    ).toBeInTheDocument();
  });
});

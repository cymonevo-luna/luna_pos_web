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
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/components/admin/expense-form", () => ({
  ExpenseForm: ({ submitLabel }: { submitLabel?: string }) => (
    <form aria-label="Expense form">
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
  });
});

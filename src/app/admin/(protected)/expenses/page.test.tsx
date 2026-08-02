import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminExpensesPage from "./page";
import { useDeleteExpense, useExpenses } from "@/lib/hooks/use-expenses";
import type { Expense } from "@/lib/api/types";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/hooks/use-expenses", () => ({
  useExpenses: vi.fn(),
  useDeleteExpense: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const expense: Expense = {
  id: "exp-1",
  title: "Office supplies",
  description: "Printer paper",
  amount: 150_000,
  source_of_fund: "PERSONAL_MONEY",
  receipt_url: "https://example.com/receipt.jpg",
  created_by_user_id: "user-1",
  created_by_username: "manager",
  transaction_date: "2026-01-15T10:30:00Z",
  created_at: "2026-01-16T11:00:00Z",
  updated_at: "2026-01-16T11:00:00Z",
};

describe("AdminExpensesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDeleteExpense).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      mutate: vi.fn(),
      error: null,
    });
    vi.mocked(useExpenses).mockReturnValue({
      expenses: [expense],
      meta: { page: 1, per_page: 10, total: 1 },
      loading: false,
      error: null,
      data: null,
      refetch: vi.fn(),
    });
  });

  it("renders transaction date column from API", async () => {
    render(<AdminExpensesPage />);

    expect(await screen.findByText("Office supplies")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Transaction date" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Created" })).not.toBeInTheDocument();
    expect(screen.getByTestId("expense-transaction-date-exp-1")).toHaveTextContent(
      "Jan 15, 2026",
    );
  });

  it("shows transaction date instead of created_at when they differ", async () => {
    vi.mocked(useExpenses).mockReturnValue({
      expenses: [
        {
          ...expense,
          transaction_date: "2025-12-28T12:30:00Z",
          created_at: "2026-01-16T11:00:00Z",
        },
      ],
      meta: { page: 1, per_page: 10, total: 1 },
      loading: false,
      error: null,
      data: null,
      refetch: vi.fn(),
    });

    render(<AdminExpensesPage />);

    expect(await screen.findByText("Office supplies")).toBeInTheDocument();
    expect(screen.getByTestId("expense-transaction-date-exp-1")).toHaveTextContent(
      "Dec 28, 2025",
    );
    expect(screen.queryByText("Jan 16, 2026")).not.toBeInTheDocument();
  });

  it("uses transaction date labels on the date range filter", async () => {
    render(<AdminExpensesPage />);
    await screen.findByText("Office supplies");

    expect(screen.getByTestId("expenses-date-preset")).toHaveAttribute(
      "aria-label",
      "Transaction date",
    );
  });

  it("reloads with transaction date range filter", async () => {
    const user = userEvent.setup();

    render(<AdminExpensesPage />);
    await screen.findByText("Office supplies");

    await user.selectOptions(screen.getByTestId("expenses-date-preset"), "custom");
    await user.type(
      screen.getByLabelText("Transaction date from"),
      "2026-01-10",
    );
    await user.type(screen.getByLabelText("Transaction date to"), "2026-01-20");

    await waitFor(() => {
      expect(useExpenses).toHaveBeenLastCalledWith({
        page: 1,
        perPage: 10,
        search: "",
        dateFrom: "2026-01-10",
        dateTo: "2026-01-20",
      });
    });
  });

  it("shows legacy backfilled transaction date matching prior created_at display", async () => {
    vi.mocked(useExpenses).mockReturnValue({
      expenses: [
        {
          ...expense,
          transaction_date: "2026-01-16T11:00:00Z",
          created_at: "2026-01-16T11:00:00Z",
        },
      ],
      meta: { page: 1, per_page: 10, total: 1 },
      loading: false,
      error: null,
      data: null,
      refetch: vi.fn(),
    });

    render(<AdminExpensesPage />);

    expect(await screen.findByText("Office supplies")).toBeInTheDocument();
    expect(screen.getByTestId("expense-transaction-date-exp-1")).toHaveTextContent(
      "Jan 16, 2026",
    );
  });
});

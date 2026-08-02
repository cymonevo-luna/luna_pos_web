import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminExpensesPage from "./page";
import { useDeleteExpense, useExpenses } from "@/lib/hooks/use-expenses";
import type { Expense } from "@/lib/api/types";
import { useFeatures } from "@/lib/auth/use-features";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/hooks/use-expenses", () => ({
  useExpenses: vi.fn(),
  useDeleteExpense: vi.fn(),
}));

vi.mock("@/lib/auth/use-features", () => ({
  useFeatures: vi.fn(),
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

function mockExpensesManageFeatures() {
  vi.mocked(useFeatures).mockReturnValue({
    features: ["expenses.manage"],
    hasFeature: (key) => key === "expenses.manage",
    hasAnyFeature: (keys) => keys.includes("expenses.manage"),
  });
}

function mockNoExpensesManageFeatures() {
  vi.mocked(useFeatures).mockReturnValue({
    features: [],
    hasFeature: () => false,
    hasAnyFeature: () => false,
  });
}

describe("AdminExpensesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExpensesManageFeatures();
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

  it("shows import button for users with expenses.manage", async () => {
    render(<AdminExpensesPage />);
    await screen.findByText("Office supplies");

    expect(screen.getByTestId("open-import-dialog")).toBeInTheDocument();
  });

  it("hides import button without expenses.manage", async () => {
    mockNoExpensesManageFeatures();

    render(<AdminExpensesPage />);
    await screen.findByText("Office supplies");

    expect(screen.queryByTestId("open-import-dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /New expense/i }),
    ).toBeInTheDocument();
  });

  it("opens the import dialog when Import CSV is clicked", async () => {
    const user = userEvent.setup();

    render(<AdminExpensesPage />);
    await screen.findByText("Office supplies");

    await user.click(screen.getByTestId("open-import-dialog"));

    expect(screen.getByTestId("expense-import-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("download-import-template")).toBeInTheDocument();
  });

  it("shows Staff salary badge for auto-generated salary expenses", async () => {
    vi.mocked(useExpenses).mockReturnValue({
      expenses: [
        {
          ...expense,
          id: "exp-salary-1",
          title: "Salary: Budi Santoso",
          recurring_expense_id: "recurring-expense-1",
          recurring_expense_staff_id: "staff-1",
        },
      ],
      meta: { page: 1, per_page: 10, total: 1 },
      loading: false,
      error: null,
      data: null,
      refetch: vi.fn(),
    });

    render(<AdminExpensesPage />);

    expect(await screen.findByText("Salary: Budi Santoso")).toBeInTheDocument();
    expect(screen.getByTestId("staff-salary-expense-badge")).toHaveTextContent(
      "Staff salary",
    );
  });

  it("does not show Staff salary badge for manual expenses", async () => {
    render(<AdminExpensesPage />);
    await screen.findByText("Office supplies");

    expect(
      screen.queryByTestId("staff-salary-expense-badge"),
    ).not.toBeInTheDocument();
  });
});

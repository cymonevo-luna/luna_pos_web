import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminEditExpenseContent } from "./expense-edit-content";
import { useExpense, useUpdateExpense, useUpdateExpenseRecordDate } from "@/lib/hooks/use-expenses";
import { useAuth } from "@/lib/auth/context";
import type { Expense } from "@/lib/api/types";
import type { User } from "@/lib/api/types";
import { formatDateTime } from "@/lib/utils";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/hooks/use-expenses", () => ({
  useExpense: vi.fn(),
  useUpdateExpense: vi.fn(),
  useUpdateExpenseRecordDate: vi.fn(),
}));

vi.mock("@/lib/auth/context", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/components/admin/expense-form", () => ({
  ExpenseForm: () => <form aria-label="Expense form" />,
}));

const expense: Expense = {
  id: "exp-1",
  title: "Office supplies",
  description: "Printer paper",
  amount: 150_000,
  source_of_fund: "PERSONAL_MONEY",
  receipt_url: null,
  created_by_user_id: "user-1",
  created_by_username: "manager",
  transaction_date: "2026-01-15T10:30:00Z",
  created_at: "2026-01-16T11:00:00Z",
  updated_at: "2026-01-16T11:00:00Z",
};

const user: User = {
  id: "user-1",
  email: "manager-test@cymonevo.com",
  name: "Manager Test",
  roles: ["manager"],
  features: [],
  merchant_id: "merchant-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("AdminEditExpenseContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user,
      merchant: null,
      isLoading: false,
      isAuthenticated: true,
      isAdmin: false,
      login: vi.fn(),
      register: vi.fn(),
      registerMerchant: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });
    vi.mocked(useExpense).mockReturnValue({
      expense,
      loading: false,
      error: null,
      data: null,
      refetch: vi.fn(),
    });
    vi.mocked(useUpdateExpense).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      mutate: vi.fn(),
      error: null,
    });
    vi.mocked(useUpdateExpenseRecordDate).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      mutate: vi.fn(),
      error: null,
    });
  });

  it("displays transaction date prominently on the detail view", async () => {
    render(<AdminEditExpenseContent id="exp-1" />);

    expect(await screen.findByTestId("expense-transaction-date-card")).toBeInTheDocument();
    expect(screen.getByText("Transaction date")).toBeInTheDocument();
    expect(
      screen.getByText(formatDateTime(expense.transaction_date)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`Recorded at ${formatDateTime(expense.created_at)}`),
    ).toBeInTheDocument();
  });
});

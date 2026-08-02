import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminEditExpenseContent } from "./expense-edit-content";
import {
  useExpense,
  useUpdateExpense,
  useUpdateExpenseRecordDate,
} from "@/lib/hooks/use-expenses";
import { useAuth } from "@/lib/auth/context";
import { ApiError } from "@/lib/api/client";
import type { ApiResult } from "@/lib/api/client";
import type { Expense } from "@/lib/api/types";
import type { User } from "@/lib/api/types";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { renderWithProviders } from "@/test/render";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/hooks/use-expenses", () => ({
  useExpense: vi.fn(),
  useUpdateExpense: vi.fn(),
  useUpdateExpenseRecordDate: vi.fn(),
}));

vi.mock("@/lib/auth/context", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/hooks/use-cashier-balance", () => ({
  useCashierBalance: () => ({
    balance: { balance: 500_000 },
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
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
  receipt_url: null,
  created_by_user_id: "user-1",
  created_by_username: "manager",
  transaction_date: "2026-01-15T10:30:00Z",
  created_at: "2026-01-16T11:00:00Z",
  updated_at: "2026-01-16T11:00:00Z",
};

const managerUser: User = {
  id: "user-1",
  email: "manager-test@cymonevo.com",
  name: "Manager Test",
  roles: ["manager"],
  features: [],
  merchant_id: "merchant-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const adminUser: User = {
  ...managerUser,
  email: "admin-test@cymonevo.com",
  name: "Admin Test",
  roles: ["admin"],
  features: ["records.edit_date"],
};

function mockAuthUser(user: User) {
  vi.mocked(useAuth).mockReturnValue({
    user,
    merchant: null,
    isLoading: false,
    isAuthenticated: true,
    isAdmin: user.roles.includes("admin"),
    login: vi.fn(),
    register: vi.fn(),
    registerMerchant: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  });
}

function mockExpenseState(expenseData: Expense = expense) {
  vi.mocked(useExpense).mockReturnValue({
    expense: expenseData,
    loading: false,
    error: null,
    data: null,
    refetch: vi.fn(),
  });
}

describe("AdminEditExpenseContent", () => {
  const updateExpenseRecordDate = vi.fn();
  const updateExpense = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser(managerUser);
    mockExpenseState();
    updateExpenseRecordDate.mockReset();
    updateExpense.mockReset();
    vi.mocked(useUpdateExpense).mockReturnValue({
      mutateAsync: updateExpense,
      isPending: false,
      mutate: vi.fn(),
      error: null,
    });
    vi.mocked(useUpdateExpenseRecordDate).mockReturnValue({
      mutateAsync: updateExpenseRecordDate,
      isPending: false,
      mutate: vi.fn(),
      error: null,
    });
  });

  it("displays transaction date prominently on the detail view", async () => {
    renderWithProviders(<AdminEditExpenseContent id="exp-1" />);

    expect(
      await screen.findByTestId("expense-transaction-date-card"),
    ).toBeInTheDocument();
    expect(screen.getByText("Transaction date")).toBeInTheDocument();
    expect(screen.getByTestId("expense-transaction-date-display")).toHaveTextContent(
      formatDateTime(expense.transaction_date),
    );
    expect(screen.getByTestId("expense-recorded-at-display")).toHaveTextContent(
      `Recorded at ${formatDateTime(expense.created_at)}`,
    );
  });

  it("allows admin with records.edit_date to edit record date", async () => {
    const user = userEvent.setup();
    mockAuthUser(adminUser);
    const updatedTransactionDate = "2026-01-08T10:30:00Z";
    const updatedExpense: Expense = {
      ...expense,
      transaction_date: updatedTransactionDate,
    };

    updateExpenseRecordDate.mockResolvedValue({
      data: updatedExpense,
    } as ApiResult<Expense>);

    renderWithProviders(<AdminEditExpenseContent id="exp-1" />);
    await screen.findByTestId("expense-record-date-section");

    const recordDateInput = screen.getByTestId("expense-record-date-input");
    fireEvent.change(recordDateInput, { target: { value: "2026-01-08T17:30" } });
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(updateExpenseRecordDate).toHaveBeenCalledWith(
        "exp-1",
        expect.any(Date),
      );
      expect(toast.success).toHaveBeenCalledWith("Expense updated");
      expect(mockPush).toHaveBeenCalledWith("/admin/expenses");
    });

    const transactionDateCard = screen.getByTestId("expense-transaction-date-card");
    expect(
      within(transactionDateCard).getByTestId("expense-transaction-date-display"),
    ).toHaveTextContent(formatDateTime(updatedTransactionDate));
  });

  it("keeps recorded-at timestamp unchanged after record date edit", async () => {
    const user = userEvent.setup();
    mockAuthUser(adminUser);
    const recordedAt = formatDateTime(expense.created_at);
    const updatedTransactionDate = "2026-01-08T10:30:00Z";

    updateExpenseRecordDate.mockResolvedValue({
      data: {
        ...expense,
        transaction_date: updatedTransactionDate,
        created_at: expense.created_at,
      },
    } as ApiResult<Expense>);

    renderWithProviders(<AdminEditExpenseContent id="exp-1" />);
    await screen.findByTestId("expense-record-date-section");

    expect(screen.getByTestId("expense-recorded-at-display")).toHaveTextContent(
      `Recorded at ${recordedAt}`,
    );

    const recordDateInput = screen.getByTestId("expense-record-date-input");
    fireEvent.change(recordDateInput, { target: { value: "2026-01-08T17:30" } });
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(updateExpenseRecordDate).toHaveBeenCalled();
    });

    expect(screen.getByTestId("expense-recorded-at-display")).toHaveTextContent(
      `Recorded at ${recordedAt}`,
    );
  });

  it("does not show record date editor without records.edit_date", async () => {
    renderWithProviders(<AdminEditExpenseContent id="exp-1" />);
    await screen.findByTestId("expense-edit-page");

    expect(
      screen.queryByTestId("expense-record-date-section"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("expense-record-date-input"),
    ).not.toBeInTheDocument();
  });

  it("rejects future record dates in the form", async () => {
    const user = userEvent.setup();
    mockAuthUser(adminUser);

    renderWithProviders(<AdminEditExpenseContent id="exp-1" />);
    await screen.findByTestId("expense-record-date-section");

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowLocal = `${tomorrow.getFullYear()}-${String(
      tomorrow.getMonth() + 1,
    ).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}T12:00`;

    const recordDateInput = screen.getByTestId("expense-record-date-input");
    fireEvent.change(recordDateInput, { target: { value: tomorrowLocal } });
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByTestId("expense-record-date-error"),
    ).toHaveTextContent(/cannot be in the future/i);
    expect(updateExpenseRecordDate).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("surfaces API validation errors for record_date", async () => {
    const user = userEvent.setup();
    mockAuthUser(adminUser);

    updateExpenseRecordDate.mockRejectedValue(
      new ApiError(400, "validation_error", "Validation failed", {
        record_date: "Record date cannot be in the future",
      }),
    );

    renderWithProviders(<AdminEditExpenseContent id="exp-1" />);
    await screen.findByTestId("expense-record-date-section");

    const recordDateInput = screen.getByTestId("expense-record-date-input");
    fireEvent.change(recordDateInput, { target: { value: "2026-01-08T17:30" } });
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByTestId("expense-record-date-error"),
    ).toHaveTextContent("Record date cannot be in the future");
    expect(mockPush).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminCashierBalancePage from "./page";
import {
  createAdjustment,
  deleteEntry,
  getBalance,
  listEntries,
  updateEntryRecordDate,
} from "@/lib/api/cashier-balance";
import { ApiError } from "@/lib/api/client";
import type { CashierBalanceEntry } from "@/lib/api/types";
import { useFeatures } from "@/lib/auth/use-features";
import { formatRupiah } from "@/lib/utils";
import { toast } from "sonner";

vi.mock("@/lib/api/cashier-balance", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/cashier-balance")>();
  return {
    ...actual,
    getBalance: vi.fn(),
    listEntries: vi.fn(),
    createAdjustment: vi.fn(),
    deleteEntry: vi.fn(),
    updateEntryRecordDate: vi.fn(),
  };
});

vi.mock("@/lib/auth/use-features", () => ({
  useFeatures: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const manualEntry: CashierBalanceEntry = {
  id: "cb-entry-1",
  type: "ADD",
  source: "MANUAL",
  amount: 100_000,
  purpose: "Opening float",
  created_at: "2026-01-01T00:00:00Z",
  transaction_id: null,
  expense_id: null,
  requested_by_username: "manager",
};

const cashPaymentEntry: CashierBalanceEntry = {
  id: "cb-entry-cash",
  type: "ADD",
  source: "CASH_PAYMENT",
  amount: 25_000,
  purpose: "Cash sale",
  created_at: "2026-01-02T00:00:00Z",
  transaction_id: "txn-1",
  requested_by_username: "cashier",
};

function mockManagerFeatures() {
  vi.mocked(useFeatures).mockReturnValue({
    features: ["cashier_balance.manage"],
    hasFeature: (key) => key === "cashier_balance.manage",
    hasAnyFeature: (keys) => keys.includes("cashier_balance.manage"),
  });
}

function mockAdminDeleteFeatures() {
  vi.mocked(useFeatures).mockReturnValue({
    features: ["cashier_balance.manage", "cashier_balance.delete_entry"],
    hasFeature: (key) =>
      key === "cashier_balance.manage" || key === "cashier_balance.delete_entry",
    hasAnyFeature: (keys) =>
      keys.some(
        (key) =>
          key === "cashier_balance.manage" || key === "cashier_balance.delete_entry",
      ),
  });
}

function mockAdminEditDateFeatures() {
  vi.mocked(useFeatures).mockReturnValue({
    features: ["cashier_balance.manage", "records.edit_date"],
    hasFeature: (key) =>
      key === "cashier_balance.manage" || key === "records.edit_date",
    hasAnyFeature: (keys) =>
      keys.some(
        (key) =>
          key === "cashier_balance.manage" || key === "records.edit_date",
      ),
  });
}

describe("AdminCashierBalancePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockManagerFeatures();
    vi.mocked(getBalance).mockResolvedValue({
      data: { balance: 500_000, updated_at: "2026-01-01T00:00:00Z" },
    });
    vi.mocked(listEntries).mockResolvedValue({
      data: [manualEntry],
      meta: { page: 1, per_page: 10, total: 1 },
    });
  });

  it("renders balance and entries from the API", async () => {
    render(<AdminCashierBalancePage />);

    expect(
      await screen.findByRole("heading", { name: "Cashier Balance" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("cashier-balance-amount")).toHaveTextContent(
      formatRupiah(500_000),
    );
    expect(screen.getByText("Opening float")).toBeInTheDocument();
  });

  it("renders Deduct with destructive styling and Add without it", async () => {
    render(<AdminCashierBalancePage />);

    await screen.findByTestId("cashier-balance-amount");

    const addButton = screen.getByTestId("cashier-balance-add-button");
    const deductButton = screen.getByTestId("cashier-balance-deduct-button");

    expect(deductButton).toHaveClass("bg-destructive", "text-destructive-foreground");
    expect(addButton).not.toHaveClass("bg-destructive");
    expect(addButton).toHaveClass("bg-primary");
  });

  it("opens deduct dialog and submits a valid adjustment", async () => {
    const user = userEvent.setup();
    vi.mocked(createAdjustment).mockResolvedValue({
      data: {
        id: "cb-entry-2",
        type: "DEDUCT",
        source: "MANUAL",
        amount: 50_000,
        purpose: "Petty cash",
        created_at: "2026-01-02T00:00:00Z",
        transaction_id: null,
        requested_by_username: "manager",
      },
    });
    vi.mocked(getBalance)
      .mockResolvedValueOnce({
        data: { balance: 500_000, updated_at: "2026-01-01T00:00:00Z" },
      })
      .mockResolvedValue({
        data: { balance: 450_000, updated_at: "2026-01-02T00:00:00Z" },
      });

    render(<AdminCashierBalancePage />);
    await screen.findByTestId("cashier-balance-amount");

    await user.click(screen.getByTestId("cashier-balance-deduct-button"));

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Deduct cashier balance" }),
    ).toBeInTheDocument();

    await user.type(screen.getByTestId("cashier-balance-amount-input"), "50000");
    await user.type(
      screen.getByTestId("cashier-balance-purpose-input"),
      "Petty cash",
    );
    await user.click(screen.getByTestId("cashier-balance-submit"));

    await waitFor(() => {
      expect(createAdjustment).toHaveBeenCalledWith({
        type: "DEDUCT",
        amount: 50_000,
        purpose: "Petty cash",
      });
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Cash deducted from cashier balance",
    );
  });

  it("opens add dialog and submits a valid adjustment", async () => {
    const user = userEvent.setup();
    vi.mocked(createAdjustment).mockResolvedValue({
      data: {
        id: "cb-entry-3",
        type: "ADD",
        source: "MANUAL",
        amount: 25_000,
        purpose: "Top up",
        created_at: "2026-01-03T00:00:00Z",
        transaction_id: null,
        requested_by_username: "manager",
      },
    });

    render(<AdminCashierBalancePage />);
    await screen.findByTestId("cashier-balance-amount");

    await user.click(screen.getByTestId("cashier-balance-add-button"));

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Add cashier balance" }),
    ).toBeInTheDocument();

    await user.type(screen.getByTestId("cashier-balance-amount-input"), "25000");
    await user.type(
      screen.getByTestId("cashier-balance-purpose-input"),
      "Top up",
    );
    await user.click(screen.getByTestId("cashier-balance-submit"));

    await waitFor(() => {
      expect(createAdjustment).toHaveBeenCalledWith({
        type: "ADD",
        amount: 25_000,
        purpose: "Top up",
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Cash added to cashier balance");
  });

  it("shows delete on manual history row for admin", async () => {
    mockAdminDeleteFeatures();
    render(<AdminCashierBalancePage />);

    expect(
      await screen.findByTestId("cashier-balance-delete-cb-entry-1"),
    ).toBeInTheDocument();
  });

  it("hides delete controls for manager", async () => {
    mockManagerFeatures();
    render(<AdminCashierBalancePage />);

    await screen.findByTestId("cashier-balance-amount");
    expect(
      screen.queryByTestId("cashier-balance-delete-cb-entry-1"),
    ).not.toBeInTheDocument();
  });

  it("does not show delete for transaction-linked rows", async () => {
    mockAdminDeleteFeatures();
    vi.mocked(listEntries).mockResolvedValue({
      data: [cashPaymentEntry],
      meta: { page: 1, per_page: 10, total: 1 },
    });

    render(<AdminCashierBalancePage />);
    await screen.findByText("Cash sale");

    expect(
      screen.queryByTestId("cashier-balance-delete-cb-entry-cash"),
    ).not.toBeInTheDocument();
  });

  it("deletes a manual entry after confirmation and refreshes data", async () => {
    const user = userEvent.setup();
    mockAdminDeleteFeatures();
    const deductEntry: CashierBalanceEntry = {
      ...manualEntry,
      id: "cb-entry-deduct",
      type: "DEDUCT",
      amount: 50_000,
      purpose: "Petty cash",
    };
    vi.mocked(listEntries).mockResolvedValue({
      data: [deductEntry],
      meta: { page: 1, per_page: 10, total: 1 },
    });
    vi.mocked(deleteEntry).mockResolvedValue({
      data: { balance: 550_000, updated_at: "2026-01-03T00:00:00Z" },
    });

    render(<AdminCashierBalancePage />);
    await screen.findByTestId("cashier-balance-delete-cb-entry-deduct");

    await user.click(
      screen.getByTestId("cashier-balance-delete-cb-entry-deduct"),
    );

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText(
        "Remove this history item? This will adjust the cashier balance.",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByTestId("cashier-balance-delete-confirm"));

    await waitFor(() => {
      expect(deleteEntry).toHaveBeenCalledWith("cb-entry-deduct");
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Cashier balance history item removed",
    );
    expect(getBalance).toHaveBeenCalledTimes(2);
    expect(listEntries).toHaveBeenCalledTimes(2);
  });

  it("shows friendly error for entry_not_deletable", async () => {
    const user = userEvent.setup();
    mockAdminDeleteFeatures();
    vi.mocked(deleteEntry).mockRejectedValue(
      new ApiError(422, "entry_not_deletable", "Entry cannot be deleted"),
    );

    render(<AdminCashierBalancePage />);
    await screen.findByTestId("cashier-balance-delete-cb-entry-1");

    await user.click(screen.getByTestId("cashier-balance-delete-cb-entry-1"));
    await user.click(screen.getByTestId("cashier-balance-delete-confirm"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Transaction-linked entries cannot be removed.",
      );
    });
  });

  it("shows friendly error for insufficient_balance", async () => {
    const user = userEvent.setup();
    mockAdminDeleteFeatures();
    vi.mocked(deleteEntry).mockRejectedValue(
      new ApiError(
        422,
        "insufficient_balance",
        "Removing this entry would overdraw the cashier balance.",
      ),
    );

    render(<AdminCashierBalancePage />);
    await screen.findByTestId("cashier-balance-delete-cb-entry-1");

    await user.click(screen.getByTestId("cashier-balance-delete-cb-entry-1"));
    await user.click(screen.getByTestId("cashier-balance-delete-confirm"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Removing this entry would overdraw the cashier balance.",
      );
    });
  });

  it("shows edit date on manual history row for admin", async () => {
    mockAdminEditDateFeatures();
    render(<AdminCashierBalancePage />);

    expect(
      await screen.findByTestId("cashier-balance-edit-date-cb-entry-1"),
    ).toBeInTheDocument();
  });

  it("hides edit date controls for manager", async () => {
    mockManagerFeatures();
    render(<AdminCashierBalancePage />);

    await screen.findByTestId("cashier-balance-amount");
    expect(
      screen.queryByTestId("cashier-balance-edit-date-cb-entry-1"),
    ).not.toBeInTheDocument();
  });

  it("does not show edit date for transaction-linked rows", async () => {
    mockAdminEditDateFeatures();
    vi.mocked(listEntries).mockResolvedValue({
      data: [cashPaymentEntry],
      meta: { page: 1, per_page: 10, total: 1 },
    });

    render(<AdminCashierBalancePage />);
    await screen.findByText("Cash sale");

    expect(
      screen.queryByTestId("cashier-balance-edit-date-cb-entry-cash"),
    ).not.toBeInTheDocument();
  });

  it("edits a manual entry date and refreshes data", async () => {
    const user = userEvent.setup();
    mockAdminEditDateFeatures();
    vi.mocked(updateEntryRecordDate).mockResolvedValue({
      data: {
        ...manualEntry,
        created_at: "2026-02-15T10:00:00Z",
      },
    });
    vi.mocked(listEntries)
      .mockResolvedValueOnce({
        data: [manualEntry],
        meta: { page: 1, per_page: 10, total: 1 },
      })
      .mockResolvedValue({
        data: [{ ...manualEntry, created_at: "2026-02-15T10:00:00Z" }],
        meta: { page: 1, per_page: 10, total: 1 },
      });

    render(<AdminCashierBalancePage />);
    await screen.findByTestId("cashier-balance-edit-date-cb-entry-1");

    await user.click(screen.getByTestId("cashier-balance-edit-date-cb-entry-1"));

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Edit date" }),
    ).toBeInTheDocument();

    const dateInput = screen.getByTestId("cashier-balance-edit-date-input");
    await user.clear(dateInput);
    await user.type(dateInput, "2026-02-15T10:00");
    await user.click(screen.getByTestId("cashier-balance-edit-date-confirm"));

    await waitFor(() => {
      expect(updateEntryRecordDate).toHaveBeenCalledWith(
        "cb-entry-1",
        new Date("2026-02-15T10:00"),
      );
    });
    expect(toast.success).toHaveBeenCalledWith("Entry date updated");
    expect(listEntries).toHaveBeenCalledTimes(2);
  });

  it("shows API error when edit date fails", async () => {
    const user = userEvent.setup();
    mockAdminEditDateFeatures();
    vi.mocked(updateEntryRecordDate).mockRejectedValue(
      new ApiError(422, "entry_not_editable", "Linked entries cannot be edited."),
    );

    render(<AdminCashierBalancePage />);
    await screen.findByTestId("cashier-balance-edit-date-cb-entry-1");

    await user.click(screen.getByTestId("cashier-balance-edit-date-cb-entry-1"));
    await user.click(screen.getByTestId("cashier-balance-edit-date-confirm"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Linked entries cannot be edited.",
      );
    });
  });
});

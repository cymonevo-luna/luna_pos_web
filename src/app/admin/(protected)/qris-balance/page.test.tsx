import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminQrisBalancePage from "./page";
import {
  createAdjustment,
  deleteEntry,
  getBalance,
  listEntries,
  updateEntryRecordDate,
} from "@/lib/api/qris-balance";
import { ApiError } from "@/lib/api/client";
import type { QrisBalanceEntry } from "@/lib/api/types";
import { useFeatures } from "@/lib/auth/use-features";
import { formatRupiah } from "@/lib/utils";
import { toast } from "sonner";

vi.mock("@/lib/api/qris-balance", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/qris-balance")>();
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

const manualEntry: QrisBalanceEntry = {
  id: "qb-entry-1",
  type: "ADD",
  source: "MANUAL",
  amount: 100_000,
  purpose: "Opening float",
  created_at: "2026-01-01T00:00:00Z",
  transaction_id: null,
  expense_id: null,
  requested_by_username: "manager",
};

const qrisPaymentEntry: QrisBalanceEntry = {
  id: "qb-entry-qris",
  type: "ADD",
  source: "QRIS_PAYMENT",
  amount: 25_000,
  purpose: "QRIS sale",
  created_at: "2026-01-02T00:00:00Z",
  transaction_id: "txn-1",
  requested_by_username: "cashier",
};

function mockManagerFeatures() {
  vi.mocked(useFeatures).mockReturnValue({
    features: ["qris_balance.manage"],
    hasFeature: (key) => key === "qris_balance.manage",
    hasAnyFeature: (keys) => keys.includes("qris_balance.manage"),
  });
}

function mockAdminDeleteFeatures() {
  vi.mocked(useFeatures).mockReturnValue({
    features: ["qris_balance.manage", "qris_balance.delete_entry"],
    hasFeature: (key) =>
      key === "qris_balance.manage" || key === "qris_balance.delete_entry",
    hasAnyFeature: (keys) =>
      keys.some(
        (key) =>
          key === "qris_balance.manage" || key === "qris_balance.delete_entry",
      ),
  });
}

function mockAdminEditDateFeatures() {
  vi.mocked(useFeatures).mockReturnValue({
    features: ["qris_balance.manage", "records.edit_date"],
    hasFeature: (key) =>
      key === "qris_balance.manage" || key === "records.edit_date",
    hasAnyFeature: (keys) =>
      keys.some(
        (key) =>
          key === "qris_balance.manage" || key === "records.edit_date",
      ),
  });
}

describe("AdminQrisBalancePage", () => {
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

  it("renders balance summary card and Add/Deduct buttons", async () => {
    render(<AdminQrisBalancePage />);

    expect(
      await screen.findByRole("heading", { name: "QRIS Balance" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("qris-balance-summary-card")).toBeInTheDocument();
    expect(screen.getByTestId("qris-balance-add-button")).toBeInTheDocument();
    expect(screen.getByTestId("qris-balance-deduct-button")).toBeInTheDocument();
    expect(screen.getByTestId("qris-balance-amount")).toHaveTextContent(
      formatRupiah(500_000),
    );
  });

  it("opens add dialog and submits a valid adjustment", async () => {
    const user = userEvent.setup();
    vi.mocked(createAdjustment).mockResolvedValue({
      data: {
        id: "qb-entry-3",
        type: "ADD",
        source: "MANUAL",
        amount: 25_000,
        purpose: "Top up",
        created_at: "2026-01-03T00:00:00Z",
        transaction_id: null,
        requested_by_username: "manager",
      },
    });
    vi.mocked(getBalance)
      .mockResolvedValueOnce({
        data: { balance: 0, updated_at: "2026-01-01T00:00:00Z" },
      })
      .mockResolvedValue({
        data: { balance: 25_000, updated_at: "2026-01-03T00:00:00Z" },
      });
    vi.mocked(listEntries)
      .mockResolvedValueOnce({
        data: [],
        meta: { page: 1, per_page: 10, total: 0 },
      })
      .mockResolvedValue({
        data: [
          {
            ...manualEntry,
            id: "qb-entry-3",
            amount: 25_000,
            purpose: "Top up",
          },
        ],
        meta: { page: 1, per_page: 10, total: 1 },
      });

    render(<AdminQrisBalancePage />);
    await screen.findByTestId("qris-balance-amount");

    await user.click(screen.getByTestId("qris-balance-add-button"));

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Add QRIS balance" }),
    ).toBeInTheDocument();

    await user.type(screen.getByTestId("qris-balance-amount-input"), "25000");
    await user.type(
      screen.getByTestId("qris-balance-purpose-input"),
      "Top up",
    );
    await user.click(screen.getByTestId("qris-balance-submit"));

    await waitFor(() => {
      expect(createAdjustment).toHaveBeenCalledWith({
        type: "ADD",
        amount: 25_000,
        purpose: "Top up",
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Funds added to QRIS balance");
    await waitFor(() => {
      expect(getBalance).toHaveBeenCalledTimes(2);
      expect(listEntries).toHaveBeenCalledTimes(2);
    });
  });

  it("shows API error when deduct exceeds balance", async () => {
    const user = userEvent.setup();
    vi.mocked(getBalance).mockResolvedValue({
      data: { balance: 25_000, updated_at: "2026-01-01T00:00:00Z" },
    });
    vi.mocked(createAdjustment).mockRejectedValue(
      new ApiError(
        422,
        "insufficient_balance",
        "Insufficient QRIS balance for this deduction.",
      ),
    );

    render(<AdminQrisBalancePage />);
    await screen.findByTestId("qris-balance-amount");
    expect(screen.getByTestId("qris-balance-amount")).toHaveTextContent(
      formatRupiah(25_000),
    );

    await user.click(screen.getByTestId("qris-balance-deduct-button"));
    await user.type(screen.getByTestId("qris-balance-amount-input"), "50000");
    await user.type(
      screen.getByTestId("qris-balance-purpose-input"),
      "Overdraft attempt",
    );
    await user.click(screen.getByTestId("qris-balance-submit"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Insufficient QRIS balance for this deduction.",
      );
    });
    expect(screen.getByTestId("qris-balance-amount")).toHaveTextContent(
      formatRupiah(25_000),
    );
  });

  it("renders Deduct with destructive styling and Add without it", async () => {
    render(<AdminQrisBalancePage />);

    await screen.findByTestId("qris-balance-amount");

    const addButton = screen.getByTestId("qris-balance-add-button");
    const deductButton = screen.getByTestId("qris-balance-deduct-button");

    expect(deductButton).toHaveClass("bg-destructive", "text-destructive-foreground");
    expect(addButton).not.toHaveClass("bg-destructive");
    expect(addButton).toHaveClass("bg-primary");
  });

  it("shows delete on manual history row for admin", async () => {
    mockAdminDeleteFeatures();
    render(<AdminQrisBalancePage />);

    expect(
      await screen.findByTestId("qris-balance-delete-qb-entry-1"),
    ).toBeInTheDocument();
  });

  it("hides delete controls for manager", async () => {
    mockManagerFeatures();
    render(<AdminQrisBalancePage />);

    await screen.findByTestId("qris-balance-amount");
    expect(
      screen.queryByTestId("qris-balance-delete-qb-entry-1"),
    ).not.toBeInTheDocument();
  });

  it("does not show delete for transaction-linked rows", async () => {
    mockAdminDeleteFeatures();
    vi.mocked(listEntries).mockResolvedValue({
      data: [qrisPaymentEntry],
      meta: { page: 1, per_page: 10, total: 1 },
    });

    render(<AdminQrisBalancePage />);
    await screen.findByText("QRIS sale");

    expect(
      screen.queryByTestId("qris-balance-delete-qb-entry-qris"),
    ).not.toBeInTheDocument();
  });

  it("deletes a manual entry after confirmation and refreshes data", async () => {
    const user = userEvent.setup();
    mockAdminDeleteFeatures();
    const deductEntry: QrisBalanceEntry = {
      ...manualEntry,
      id: "qb-entry-deduct",
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

    render(<AdminQrisBalancePage />);
    await screen.findByTestId("qris-balance-delete-qb-entry-deduct");

    await user.click(
      screen.getByTestId("qris-balance-delete-qb-entry-deduct"),
    );

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText(
        "Remove this history item? This will adjust the QRIS balance.",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByTestId("qris-balance-delete-confirm"));

    await waitFor(() => {
      expect(deleteEntry).toHaveBeenCalledWith("qb-entry-deduct");
    });
    expect(toast.success).toHaveBeenCalledWith(
      "QRIS balance history item removed",
    );
    expect(getBalance).toHaveBeenCalledTimes(2);
    expect(listEntries).toHaveBeenCalledTimes(2);
  });

  it("shows edit date on manual history row for admin", async () => {
    mockAdminEditDateFeatures();
    render(<AdminQrisBalancePage />);

    expect(
      await screen.findByTestId("qris-balance-edit-date-qb-entry-1"),
    ).toBeInTheDocument();
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

    render(<AdminQrisBalancePage />);
    await screen.findByTestId("qris-balance-edit-date-qb-entry-1");

    await user.click(screen.getByTestId("qris-balance-edit-date-qb-entry-1"));

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Edit date" }),
    ).toBeInTheDocument();

    const dateInput = screen.getByTestId("qris-balance-edit-date-input");
    await user.clear(dateInput);
    await user.type(dateInput, "2026-02-15T10:00");
    await user.click(screen.getByTestId("qris-balance-edit-date-confirm"));

    await waitFor(() => {
      expect(updateEntryRecordDate).toHaveBeenCalledWith(
        "qb-entry-1",
        new Date("2026-02-15T03:00:00.000Z"),
      );
    });
    expect(toast.success).toHaveBeenCalledWith("Entry date updated");
    expect(listEntries).toHaveBeenCalledTimes(2);
  });
});

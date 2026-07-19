import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminCashierBalancePage from "./page";
import {
  createAdjustment,
  getBalance,
  listEntries,
} from "@/lib/api/cashier-balance";
import type { CashierBalanceEntry } from "@/lib/api/types";
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
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const entry: CashierBalanceEntry = {
  id: "cb-entry-1",
  type: "ADD",
  amount: 100_000,
  purpose: "Opening float",
  created_at: "2026-01-01T00:00:00Z",
  transaction_id: null,
  requested_by_username: "manager",
};

describe("AdminCashierBalancePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getBalance).mockResolvedValue({
      data: { balance: 500_000, updated_at: "2026-01-01T00:00:00Z" },
    });
    vi.mocked(listEntries).mockResolvedValue({
      data: [entry],
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
});

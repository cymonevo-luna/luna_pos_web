import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminPurchasesPage from "./page";
import {
  exportPurchaseRequestsCsv,
  purchaseRequestsAdminApi,
} from "@/lib/api/purchase-requests";
import { ApiError } from "@/lib/api/client";
import type { PurchaseRequestSummary } from "@/lib/api/types";
import { useFeatures } from "@/lib/auth/use-features";
import * as wib from "@/lib/datetime/wib";
import { toast } from "sonner";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/api/purchase-requests", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/purchase-requests")>();
  return {
    ...actual,
    purchaseRequestsAdminApi: {
      ...actual.purchaseRequestsAdminApi,
      list: vi.fn(),
    },
    exportPurchaseRequestsCsv: vi.fn(),
    downloadPurchaseRequestsCsv: vi.fn(),
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

const purchase: PurchaseRequestSummary = {
  id: "pr-1",
  supplier_id: "sup-1",
  supplier_name: "Beras Supplier",
  status: "PENDING",
  item_count: 2,
  total_estimated_amount: 280000,
  created_by_username: "admin1",
  transaction_date: "2026-01-15T10:30:00Z",
  created_at: "2026-01-15T10:30:00Z",
  updated_at: "2026-01-15T10:30:00Z",
};

function mockPurchasesManageFeatures() {
  vi.mocked(useFeatures).mockReturnValue({
    features: ["purchases.manage"],
    hasFeature: (key) => key === "purchases.manage",
    hasAnyFeature: (keys) => keys.includes("purchases.manage"),
  });
}

function mockNoPurchasesManageFeatures() {
  vi.mocked(useFeatures).mockReturnValue({
    features: [],
    hasFeature: () => false,
    hasAnyFeature: () => false,
  });
}

describe("AdminPurchasesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPurchasesManageFeatures();
    vi.spyOn(wib, "todayWIB").mockReturnValue("2026-07-25");
    vi.mocked(purchaseRequestsAdminApi.list).mockResolvedValue({
      data: [purchase],
      meta: { page: 1, per_page: 10, total: 1 },
    });
  });

  it("renders table headers and purchase rows from the API", async () => {
    render(<AdminPurchasesPage />);

    expect(await screen.findByText("Beras Supplier")).toBeInTheDocument();
    expect(screen.getByText("Rp 280.000")).toBeInTheDocument();
    expect(screen.getByText("admin1")).toBeInTheDocument();
    expect(screen.getByText("1 total")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Transaction date" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Supplier" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Status" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Items" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Total" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Created by" }),
    ).toBeInTheDocument();
  });

  it("shows transaction date from API in the list", async () => {
    vi.mocked(purchaseRequestsAdminApi.list).mockResolvedValue({
      data: [
        {
          ...purchase,
          transaction_date: "2025-12-28T12:30:00Z",
          created_at: "2026-01-15T10:30:00Z",
        },
      ],
      meta: { page: 1, per_page: 10, total: 1 },
    });

    render(<AdminPurchasesPage />);

    expect(await screen.findByText("Beras Supplier")).toBeInTheDocument();
    expect(screen.getByText("Dec 28, 2025")).toBeInTheDocument();
  });

  it("uses transaction date labels on the date range filter", async () => {
    render(<AdminPurchasesPage />);
    await screen.findByText("Beras Supplier");

    expect(screen.getByTestId("purchases-date-preset")).toHaveAttribute(
      "aria-label",
      "Transaction date",
    );
  });

  it("reloads with transaction date range filter", async () => {
    const user = userEvent.setup();

    render(<AdminPurchasesPage />);
    await screen.findByText("Beras Supplier");

    await user.selectOptions(
      screen.getByTestId("purchases-date-preset"),
      "custom",
    );
    await user.type(
      screen.getByLabelText("Transaction date from"),
      "2026-01-10",
    );
    await user.type(
      screen.getByLabelText("Transaction date to"),
      "2026-01-20",
    );

    await waitFor(() => {
      expect(purchaseRequestsAdminApi.list).toHaveBeenLastCalledWith({
        page: 1,
        perPage: 10,
        status: "",
        dateFrom: "2026-01-10",
        dateTo: "2026-01-20",
      });
    });
  });

  it("links to the new purchase request page", async () => {
    render(<AdminPurchasesPage />);
    await screen.findByText("Beras Supplier");

    expect(
      screen.getByRole("link", { name: "New purchase request" }),
    ).toHaveAttribute("href", "/admin/purchases/new");
  });

  it("shows empty state when no purchase requests match", async () => {
    vi.mocked(purchaseRequestsAdminApi.list).mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 10, total: 0 },
    });

    render(<AdminPurchasesPage />);

    expect(
      await screen.findByText("No purchase requests found."),
    ).toBeInTheDocument();
  });

  it("reloads with status filter", async () => {
    const user = userEvent.setup();

    render(<AdminPurchasesPage />);
    await screen.findByText("Beras Supplier");

    await user.selectOptions(
      screen.getByLabelText("Filter by status"),
      "PENDING",
    );

    await waitFor(() => {
      expect(purchaseRequestsAdminApi.list).toHaveBeenLastCalledWith({
        page: 1,
        perPage: 10,
        status: "PENDING",
        dateFrom: "",
        dateTo: "",
      });
    });
  });

  it("navigates to detail on row click", async () => {
    const user = userEvent.setup();

    render(<AdminPurchasesPage />);
    await screen.findByText("Beras Supplier");

    await user.click(screen.getByText("Beras Supplier"));

    expect(mockPush).toHaveBeenCalledWith("/admin/purchases/pr-1");
  });

  it("shows em dash when created_by_username is null", async () => {
    vi.mocked(purchaseRequestsAdminApi.list).mockResolvedValue({
      data: [{ ...purchase, created_by_username: null }],
      meta: { page: 1, per_page: 10, total: 1 },
    });

    render(<AdminPurchasesPage />);

    expect(await screen.findByText("Beras Supplier")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows error toast when loading fails", async () => {
    vi.mocked(purchaseRequestsAdminApi.list).mockRejectedValue(
      new ApiError(500, "server_error", "Server error"),
    );

    render(<AdminPurchasesPage />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Server error");
    });
  });

  it("shows formatted total estimation from total_estimated_amount", async () => {
    render(<AdminPurchasesPage />);

    expect(await screen.findByText("Rp 280.000")).toBeInTheDocument();
    expect(screen.queryByText("Rp 0")).not.toBeInTheDocument();
  });

  it("renders Rp 0 when total_estimated_amount is zero", async () => {
    vi.mocked(purchaseRequestsAdminApi.list).mockResolvedValue({
      data: [{ ...purchase, total_estimated_amount: 0 }],
      meta: { page: 1, per_page: 10, total: 1 },
    });

    render(<AdminPurchasesPage />);

    expect(await screen.findByText("Rp 0")).toBeInTheDocument();
  });

  it("renders multiple rows with different total estimations", async () => {
    const secondPurchase: PurchaseRequestSummary = {
      ...purchase,
      id: "pr-2",
      supplier_name: "Sayur Supplier",
      total_estimated_amount: 40000,
    };

    vi.mocked(purchaseRequestsAdminApi.list).mockResolvedValue({
      data: [
        { ...purchase, total_estimated_amount: 118000 },
        secondPurchase,
      ],
      meta: { page: 1, per_page: 10, total: 2 },
    });

    render(<AdminPurchasesPage />);

    expect(await screen.findByText("Rp 118.000")).toBeInTheDocument();
    expect(screen.getByText("Rp 40.000")).toBeInTheDocument();
  });

  it("refetches list on remount so deleted purchase is not shown", async () => {
    const { unmount } = render(<AdminPurchasesPage />);

    expect(await screen.findByText("Beras Supplier")).toBeInTheDocument();
    expect(purchaseRequestsAdminApi.list).toHaveBeenCalledTimes(1);

    unmount();

    vi.mocked(purchaseRequestsAdminApi.list).mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 10, total: 0 },
    });

    render(<AdminPurchasesPage />);

    await waitFor(() => {
      expect(purchaseRequestsAdminApi.list).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText("Beras Supplier")).not.toBeInTheDocument();
    expect(screen.getByText("0 total")).toBeInTheDocument();
  });

  it("shows actual total when present, otherwise estimated", async () => {
    vi.mocked(purchaseRequestsAdminApi.list).mockResolvedValue({
      data: [
        { ...purchase, total_actual_amount: 300000 },
        {
          ...purchase,
          id: "pr-legacy",
          supplier_name: "Legacy Supplier",
          total_estimated_amount: 50000,
        },
      ],
      meta: { page: 1, per_page: 10, total: 2 },
    });

    render(<AdminPurchasesPage />);

    expect(await screen.findByText("Beras Supplier")).toBeInTheDocument();
    expect(screen.getByText("Rp 300.000")).toBeInTheDocument();
    expect(screen.getByText("Legacy Supplier")).toBeInTheDocument();
    expect(screen.getByText("Rp 50.000")).toBeInTheDocument();
  });

  it("shows export controls for users with purchases.manage", async () => {
    render(<AdminPurchasesPage />);
    await screen.findByText("Beras Supplier");

    expect(screen.getByTestId("purchase-export-section")).toBeInTheDocument();
    expect(screen.getByTestId("export-transaction-date")).toHaveValue(
      "2026-07-25",
    );
    expect(screen.getByLabelText("Export status filter")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Export/i }),
    ).toBeInTheDocument();
  });

  it("hides export controls without purchases.manage", async () => {
    mockNoPurchasesManageFeatures();

    render(<AdminPurchasesPage />);
    await screen.findByText("Beras Supplier");

    expect(
      screen.queryByTestId("purchase-export-section"),
    ).not.toBeInTheDocument();
  });

  it("exports CSV and shows success toast", async () => {
    const user = userEvent.setup();
    const { downloadPurchaseRequestsCsv } = await import(
      "@/lib/api/purchase-requests"
    );
    const blob = new Blob(["item_name,supplier_name"]);
    vi.mocked(exportPurchaseRequestsCsv).mockResolvedValue({
      blob,
      filename: "purchase-requests-2026-07-25.csv",
    });

    render(<AdminPurchasesPage />);
    await screen.findByText("Beras Supplier");

    await user.click(screen.getByRole("button", { name: /Export/i }));

    await waitFor(() => {
      expect(exportPurchaseRequestsCsv).toHaveBeenCalledWith({
        transactionDate: "2026-07-25",
        status: undefined,
      });
      expect(downloadPurchaseRequestsCsv).toHaveBeenCalledWith(blob, {
        filename: "purchase-requests-2026-07-25.csv",
        date: new Date("2026-07-25T00:00:00"),
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Purchase requests CSV exported",
      );
    });
  });

  it("passes selected status filter to export API", async () => {
    const user = userEvent.setup();
    vi.mocked(exportPurchaseRequestsCsv).mockResolvedValue({
      blob: new Blob(["item_name,supplier_name"]),
    });

    render(<AdminPurchasesPage />);
    await screen.findByText("Beras Supplier");

    await user.selectOptions(
      screen.getByLabelText("Export status filter"),
      "PAID",
    );
    await user.click(screen.getByRole("button", { name: /Export/i }));

    await waitFor(() => {
      expect(exportPurchaseRequestsCsv).toHaveBeenCalledWith({
        transactionDate: "2026-07-25",
        status: "PAID",
      });
    });
  });

  it("shows inline validation errors and error toast when export fails", async () => {
    const user = userEvent.setup();
    vi.mocked(exportPurchaseRequestsCsv).mockRejectedValue(
      new ApiError(422, "validation_error", "Invalid export parameters", {
        transaction_date: "Transaction date is required",
      }),
    );

    render(<AdminPurchasesPage />);
    await screen.findByText("Beras Supplier");

    await user.click(screen.getByRole("button", { name: /Export/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Transaction date is required"),
      ).toBeInTheDocument();
      expect(toast.error).toHaveBeenCalledWith("Invalid export parameters");
    });
  });

  it("shows error toast when export fails without field errors", async () => {
    const user = userEvent.setup();
    vi.mocked(exportPurchaseRequestsCsv).mockRejectedValue(
      new ApiError(500, "server_error", "Export failed"),
    );

    render(<AdminPurchasesPage />);
    await screen.findByText("Beras Supplier");

    await user.click(screen.getByRole("button", { name: /Export/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Export failed");
    });
  });

  it("shows import button for users with purchases.manage", async () => {
    render(<AdminPurchasesPage />);
    await screen.findByText("Beras Supplier");

    expect(screen.getByTestId("open-import-dialog")).toBeInTheDocument();
  });

  it("hides import button without purchases.manage", async () => {
    mockNoPurchasesManageFeatures();

    render(<AdminPurchasesPage />);
    await screen.findByText("Beras Supplier");

    expect(screen.queryByTestId("open-import-dialog")).not.toBeInTheDocument();
  });

  it("opens the import dialog when Import CSV is clicked", async () => {
    const user = userEvent.setup();

    render(<AdminPurchasesPage />);
    await screen.findByText("Beras Supplier");

    await user.click(screen.getByTestId("open-import-dialog"));

    expect(screen.getByTestId("purchase-import-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("download-import-template")).toBeInTheDocument();
  });
});

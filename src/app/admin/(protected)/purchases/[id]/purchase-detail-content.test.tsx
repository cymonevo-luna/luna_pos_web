import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminPurchaseDetailContent } from "./purchase-detail-content";
import { purchaseRequestsAdminApi } from "@/lib/api/purchase-requests";
import { uploadPurchasePhoto } from "@/lib/api/uploads";
import { ApiError } from "@/lib/api/client";
import type { PurchaseRequest } from "@/lib/api/types";
import { config } from "@/lib/config";
import { toast } from "sonner";

vi.mock("@/lib/api/purchase-requests", () => ({
  purchaseRequestsAdminApi: {
    get: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

vi.mock("@/lib/api/uploads", () => ({
  uploadPurchasePhoto: vi.fn(),
  validateMenuPhotoFile: vi.fn((file: File) => {
    if (!file.type.startsWith("image/")) {
      return "File must be a JPEG, PNG, or WebP image";
    }
    return null;
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function createImageFile(name = "receipt.jpg"): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: "image/jpeg" });
}

const purchase: PurchaseRequest = {
  id: "pr-1",
  supplier_id: "sup-1",
  supplier_name: "Beras Supplier",
  supplier_contact_info: "08123456789",
  status: "PENDING",
  notes: null,
  created_by_username: "admin",
  status_history: [
    {
      id: "hist-1",
      from_status: null,
      to_status: "PENDING",
      changed_by_username: "admin",
      photo_url: null,
      created_at: "2026-01-01T00:00:00Z",
    },
  ],
  items: [
    {
      id: "item-1",
      food_supply_id: "fs-1",
      food_supply_title: "Beras",
      unit: "piece",
      quantity: 3,
      price_quantity: 1,
      unit_price: 26000,
      price_amount: 26000,
      line_estimated_amount: 78000,
    },
    {
      id: "item-2",
      food_supply_id: "fs-2",
      food_supply_title: "Gula",
      unit: "piece",
      quantity: 2,
      price_quantity: 1,
      unit_price: 20000,
      price_amount: 20000,
      line_estimated_amount: 40000,
    },
  ],
  total_estimated_amount: 118000,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("AdminPurchaseDetailContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(purchaseRequestsAdminApi.get).mockResolvedValue({ data: purchase });
  });

  it("renders purchase detail with line items and total", async () => {
    render(<AdminPurchaseDetailContent id="pr-1" />);

    expect(await screen.findByText("Beras Supplier")).toBeInTheDocument();
    expect(screen.getByText("Beras")).toBeInTheDocument();
    expect(screen.getByText("Gula")).toBeInTheDocument();
    expect(screen.getByText("3 pcs")).toBeInTheDocument();
    expect(screen.getByText("2 pcs")).toBeInTheDocument();

    const createdByCard = screen.getByText("Created by").closest(
      ".rounded-2xl",
    ) as HTMLElement;
    expect(within(createdByCard).getByText("admin")).toBeInTheDocument();

    const totalEstimateLabels = screen.getAllByText("Total estimate");
    expect(totalEstimateLabels).toHaveLength(2);

    const summaryCard = totalEstimateLabels[0].closest(
      ".rounded-2xl",
    ) as HTMLElement | null;
    expect(summaryCard).not.toBeNull();
    expect(within(summaryCard as HTMLElement).getByText("Rp 118.000")).toBeInTheDocument();

    const lineItemsTable = screen.getAllByRole("table")[0] as HTMLTableElement;
    expect(within(lineItemsTable).getByText("Rp 78.000")).toBeInTheDocument();
    expect(within(lineItemsTable).getByText("Rp 40.000")).toBeInTheDocument();
    expect(within(lineItemsTable).getByText("Rp 118.000")).toBeInTheDocument();

    const unitPriceCells = within(lineItemsTable).getAllByText("Rp 26.000 / piece");
    expect(unitPriceCells).toHaveLength(1);
    expect(within(lineItemsTable).getByText("Rp 20.000 / piece")).toBeInTheDocument();
    expect(within(lineItemsTable).queryByText("Rp 78.000 / piece")).not.toBeInTheDocument();
  });

  it("marks PENDING purchase as REQUESTED without opening photo modal", async () => {
    const user = userEvent.setup();
    let currentPurchase: PurchaseRequest = purchase;
    const updatedPurchase = {
      ...purchase,
      status: "REQUESTED" as const,
      status_history: [
        ...purchase.status_history,
        {
          id: "hist-2",
          from_status: "PENDING",
          to_status: "REQUESTED",
          changed_by_username: "admin",
          photo_url: null,
          created_at: "2026-01-02T00:00:00Z",
        },
      ],
    };

    vi.mocked(purchaseRequestsAdminApi.get).mockImplementation(async () => ({
      data: currentPurchase,
    }));
    vi.mocked(purchaseRequestsAdminApi.updateStatus).mockImplementation(
      async () => {
        currentPurchase = updatedPurchase;
        return { data: updatedPurchase };
      },
    );

    render(<AdminPurchaseDetailContent id="pr-1" />);
    await screen.findByText("Beras Supplier");

    await user.click(screen.getByRole("button", { name: "Mark as Requested" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(uploadPurchasePhoto).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(purchaseRequestsAdminApi.updateStatus).toHaveBeenCalledWith("pr-1", {
        status: "REQUESTED",
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Status updated");

    const statusCard = screen.getByTestId("purchase-status-card");
    expect(within(statusCard).getByText("REQUESTED")).toBeInTheDocument();
  });

  it("requires a receipt photo before marking REQUESTED purchase as PAID", async () => {
    const user = userEvent.setup();
    let currentPurchase: PurchaseRequest = { ...purchase, status: "REQUESTED" };
    const paidPurchase = {
      ...currentPurchase,
      status: "PAID" as const,
      status_history: [
        ...currentPurchase.status_history,
        {
          id: "hist-paid",
          from_status: "REQUESTED",
          to_status: "PAID",
          changed_by_username: "admin",
          photo_url: "https://cdn.example.com/receipt.jpg",
          created_at: "2026-01-03T00:00:00Z",
        },
      ],
    };

    vi.mocked(purchaseRequestsAdminApi.get).mockImplementation(async () => ({
      data: currentPurchase,
    }));
    vi.mocked(uploadPurchasePhoto).mockResolvedValue({
      url: "https://cdn.example.com/receipt.jpg",
      filename: "receipt.jpg",
      size_bytes: 1024,
    });
    vi.mocked(purchaseRequestsAdminApi.updateStatus).mockImplementation(
      async () => {
        currentPurchase = paidPurchase;
        return { data: paidPurchase };
      },
    );

    render(<AdminPurchaseDetailContent id="pr-1" />);
    await screen.findByText("Beras Supplier");

    await user.click(screen.getByRole("button", { name: "Mark as Paid" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Photo of the Receipt")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    expect(purchaseRequestsAdminApi.updateStatus).not.toHaveBeenCalled();

    const uploadInput = screen.getByTestId("purchase-photo-upload-input");
    await user.upload(uploadInput, createImageFile());

    expect(screen.getByTestId("purchase-photo-preview")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(uploadPurchasePhoto).toHaveBeenCalled();
      expect(purchaseRequestsAdminApi.updateStatus).toHaveBeenCalledWith("pr-1", {
        status: "PAID",
        photo_url: "https://cdn.example.com/receipt.jpg",
      });
    });

    const statusCard = screen.getByTestId("purchase-status-card");
    expect(within(statusCard).getByText("PAID")).toBeInTheDocument();
  });

  it("requires a package photo before marking PAID purchase as DELIVERED", async () => {
    const user = userEvent.setup();
    let currentPurchase: PurchaseRequest = { ...purchase, status: "PAID" };
    const deliveredPurchase = {
      ...currentPurchase,
      status: "DELIVERED" as const,
      status_history: [
        ...currentPurchase.status_history,
        {
          id: "hist-delivered",
          from_status: "PAID",
          to_status: "DELIVERED",
          changed_by_username: "admin",
          photo_url: "https://cdn.example.com/package.jpg",
          created_at: "2026-01-04T00:00:00Z",
        },
      ],
    };

    vi.mocked(purchaseRequestsAdminApi.get).mockImplementation(async () => ({
      data: currentPurchase,
    }));
    vi.mocked(uploadPurchasePhoto).mockResolvedValue({
      url: "https://cdn.example.com/package.jpg",
      filename: "package.jpg",
      size_bytes: 2048,
    });
    vi.mocked(purchaseRequestsAdminApi.updateStatus).mockImplementation(
      async () => {
        currentPurchase = deliveredPurchase;
        return { data: deliveredPurchase };
      },
    );

    render(<AdminPurchaseDetailContent id="pr-1" />);
    await screen.findByText("Beras Supplier");

    await user.click(screen.getByRole("button", { name: "Mark as Delivered" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Photo of the Package")).toBeInTheDocument();

    const uploadInput = screen.getByTestId("purchase-photo-upload-input");
    await user.upload(uploadInput, createImageFile("package.jpg"));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(uploadPurchasePhoto).toHaveBeenCalled();
      expect(purchaseRequestsAdminApi.updateStatus).toHaveBeenCalledWith("pr-1", {
        status: "DELIVERED",
        photo_url: "https://cdn.example.com/package.jpg",
      });
    });

    const statusCard = screen.getByTestId("purchase-status-card");
    expect(within(statusCard).getByText("DELIVERED")).toBeInTheDocument();
  });

  it("hides the status advance action when purchase is DELIVERED", async () => {
    vi.mocked(purchaseRequestsAdminApi.get).mockResolvedValue({
      data: { ...purchase, status: "DELIVERED" },
    });

    render(<AdminPurchaseDetailContent id="pr-1" />);
    await screen.findByText("Beras Supplier");

    expect(
      screen.queryByRole("button", { name: "Mark as Delivered" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mark as Requested" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Update status")).not.toBeInTheDocument();
  });

  it("refreshes status history after a successful status update", async () => {
    const user = userEvent.setup();
    let currentPurchase: PurchaseRequest = purchase;
    const updatedPurchase = {
      ...purchase,
      status: "REQUESTED" as const,
      status_history: [
        ...purchase.status_history,
        {
          id: "hist-2",
          from_status: "PENDING",
          to_status: "REQUESTED",
          changed_by_username: "admin",
          photo_url: null,
          created_at: "2026-01-02T00:00:00Z",
        },
      ],
    };

    vi.mocked(purchaseRequestsAdminApi.get).mockImplementation(async () => ({
      data: currentPurchase,
    }));
    vi.mocked(purchaseRequestsAdminApi.updateStatus).mockImplementation(
      async () => {
        currentPurchase = updatedPurchase;
        return { data: updatedPurchase };
      },
    );

    render(<AdminPurchaseDetailContent id="pr-1" />);
    await screen.findByText("Beras Supplier");

    const statusHistoryHeading = screen.getByRole("heading", {
      name: "Status History",
    });
    const statusHistorySection = statusHistoryHeading.closest(
      ".rounded-2xl",
    ) as HTMLElement;
    expect(
      within(statusHistorySection).getByText("PENDING"),
    ).toBeInTheDocument();
    expect(
      within(statusHistorySection).queryByText("PENDING → REQUESTED"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mark as Requested" }));

    await waitFor(() => {
      expect(purchaseRequestsAdminApi.get).toHaveBeenCalledTimes(2);
    });

    expect(
      within(statusHistorySection).getByText("PENDING → REQUESTED"),
    ).toBeInTheDocument();
  });

  it("shows API validation errors for invalid status transitions", async () => {
    const user = userEvent.setup();
    vi.mocked(purchaseRequestsAdminApi.updateStatus).mockRejectedValue(
      new ApiError(422, "invalid_transition", "Cannot change status from DELIVERED"),
    );

    render(<AdminPurchaseDetailContent id="pr-1" />);
    await screen.findByText("Beras Supplier");

    await user.click(screen.getByRole("button", { name: "Mark as Requested" }));

    expect(
      await screen.findByText("Cannot change status from DELIVERED"),
    ).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith(
      "Cannot change status from DELIVERED",
    );
  });

  it("disables contact supplier when contact info has no phone", async () => {
    vi.mocked(purchaseRequestsAdminApi.get).mockResolvedValue({
      data: {
        ...purchase,
        supplier_contact_info: "supplier@example.com",
      },
    });

    render(<AdminPurchaseDetailContent id="pr-1" />);
    await screen.findByText("Beras Supplier");

    const button = screen.getByRole("button", { name: "Contact supplier" });
    expect(button).toBeDisabled();
    expect(button.closest("span")).toHaveAttribute(
      "title",
      "No WhatsApp number in contact info",
    );
  });

  it("shows Created by from created_by_username", async () => {
    render(<AdminPurchaseDetailContent id="pr-1" />);

    const createdByCard = await screen.findByText("Created by");
    expect(
      within(createdByCard.closest(".rounded-2xl") as HTMLElement).getByText(
        "admin",
      ),
    ).toBeInTheDocument();
  });

  it("shows em dash fallback when created_by_username is null", async () => {
    vi.mocked(purchaseRequestsAdminApi.get).mockResolvedValue({
      data: { ...purchase, created_by_username: null, status_history: [] },
    });

    render(<AdminPurchaseDetailContent id="pr-1" />);

    const createdByCard = await screen.findByText("Created by");
    expect(
      within(createdByCard.closest(".rounded-2xl") as HTMLElement).getByText("—"),
    ).toBeInTheDocument();
  });

  it("shows an error card when the purchase request cannot be loaded", async () => {
    vi.mocked(purchaseRequestsAdminApi.get).mockRejectedValue(
      new Error("Purchase request not found"),
    );

    render(<AdminPurchaseDetailContent id="nonexistent-id" />);

    expect(
      await screen.findByText("Failed to load purchase request"),
    ).toBeInTheDocument();
  });

  it("renders Status History above Line items in DOM order", async () => {
    render(<AdminPurchaseDetailContent id="pr-1" />);

    const statusHistoryHeading = await screen.findByRole("heading", {
      name: "Status History",
    });
    const lineItemsHeading = screen.getByRole("heading", {
      name: "Line items",
    });

    expect(
      statusHistoryHeading.compareDocumentPosition(lineItemsHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("renders status history rows with transition, username, and timestamp", async () => {
    vi.mocked(purchaseRequestsAdminApi.get).mockResolvedValue({
      data: {
        ...purchase,
        status_history: [
          {
            id: "hist-1",
            from_status: null,
            to_status: "PENDING",
            changed_by_username: "admin",
            photo_url: null,
            created_at: "2026-01-01T08:00:00Z",
          },
          {
            id: "hist-2",
            from_status: "PENDING",
            to_status: "REQUESTED",
            changed_by_username: "manager",
            photo_url: null,
            created_at: "2026-01-02T09:30:00Z",
          },
        ],
      },
    });

    render(<AdminPurchaseDetailContent id="pr-1" />);

    const statusHistoryHeading = await screen.findByRole("heading", {
      name: "Status History",
    });
    const statusHistorySection = statusHistoryHeading.closest(
      ".rounded-2xl",
    ) as HTMLElement;

    expect(
      within(statusHistorySection).getByText("PENDING"),
    ).toBeInTheDocument();
    expect(
      within(statusHistorySection).getByText("PENDING → REQUESTED"),
    ).toBeInTheDocument();
    expect(within(statusHistorySection).getByText("manager")).toBeInTheDocument();
    expect(
      within(statusHistorySection).getByText("Jan 2, 2026, 09:30 AM"),
    ).toBeInTheDocument();
  });

  it("renders a clickable photo link for history entries with photo_url", async () => {
    vi.mocked(purchaseRequestsAdminApi.get).mockResolvedValue({
      data: {
        ...purchase,
        status_history: [
          {
            id: "hist-paid",
            from_status: "REQUESTED",
            to_status: "PAID",
            changed_by_username: "cashier",
            photo_url: "/static/uploads/receipts/receipt.jpg",
            created_at: "2026-01-03T10:00:00Z",
          },
          {
            id: "hist-delivered",
            from_status: "PAID",
            to_status: "DELIVERED",
            changed_by_username: "operational",
            photo_url: "/static/uploads/packages/package.jpg",
            created_at: "2026-01-04T11:00:00Z",
          },
        ],
      },
    });

    render(<AdminPurchaseDetailContent id="pr-1" />);

    const receiptLink = await screen.findByRole("link", { name: "Receipt photo" });
    expect(receiptLink).toHaveAttribute(
      "href",
      `${config.apiBaseUrl}/static/uploads/receipts/receipt.jpg`,
    );

    const packageLink = screen.getByRole("link", { name: "Package photo" });
    expect(packageLink).toHaveAttribute(
      "href",
      `${config.apiBaseUrl}/static/uploads/packages/package.jpg`,
    );
  });

  it("shows empty state when status history is empty", async () => {
    vi.mocked(purchaseRequestsAdminApi.get).mockResolvedValue({
      data: { ...purchase, status_history: [] },
    });

    render(<AdminPurchaseDetailContent id="pr-1" />);

    expect(await screen.findByText("No status history yet")).toBeInTheDocument();
  });
});

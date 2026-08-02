import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import AdminMenuDisposalsPage from "./page";
import { menuDisposalsAdminApi } from "@/lib/api/menu-disposals";
import { ApiError } from "@/lib/api/client";
import type { MenuDisposal } from "@/lib/api/types";
import { useFeatures } from "@/lib/auth/use-features";
import { startOfDayWIB } from "@/lib/datetime/wib";
import { toast } from "sonner";

vi.mock("@/lib/api/menu-disposals", () => ({
  menuDisposalsAdminApi: {
    list: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    updateDisposedDate: vi.fn(),
    summary: vi.fn(),
    summaryByMenu: vi.fn(),
  },
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

const disposal1: MenuDisposal = {
  id: "disposal-1",
  menu_id: "menu-1",
  menu_title: "Nasi Goreng",
  quantity: 2,
  unit_loss_amount: 15000,
  loss_amount: 30000,
  disposed_by_user_id: "user-1",
  disposed_by_username: "manager",
  note: "Expired",
  disposed_at: "2026-01-15T10:30:00Z",
  created_at: "2026-01-15T10:30:00Z",
  updated_at: "2026-01-15T10:30:00Z",
};

const disposal2: MenuDisposal = {
  id: "disposal-2",
  menu_id: "menu-2",
  menu_title: "Mie Goreng",
  quantity: 1,
  unit_loss_amount: 20000,
  loss_amount: 20000,
  disposed_by_user_id: "user-2",
  disposed_by_username: "admin",
  note: null,
  disposed_at: "2026-01-16T11:00:00Z",
  created_at: "2026-01-16T11:00:00Z",
  updated_at: "2026-01-16T11:00:00Z",
};

function mockManagerFeatures() {
  vi.mocked(useFeatures).mockReturnValue({
    features: ["menu_disposals.view"],
    hasFeature: (key) => key === "menu_disposals.view",
    hasAnyFeature: (keys) => keys.includes("menu_disposals.view"),
  });
}

function mockAdminDeleteFeatures() {
  vi.mocked(useFeatures).mockReturnValue({
    features: ["menu_disposals.view", "menu_disposals.delete"],
    hasFeature: (key) =>
      key === "menu_disposals.view" || key === "menu_disposals.delete",
    hasAnyFeature: (keys) =>
      keys.some(
        (key) =>
          key === "menu_disposals.view" || key === "menu_disposals.delete",
      ),
  });
}

function mockAdminEditDateFeatures() {
  vi.mocked(useFeatures).mockReturnValue({
    features: [
      "menu_disposals.view",
      "menu_disposals.delete",
      "records.edit_date",
    ],
    hasFeature: (key) =>
      key === "menu_disposals.view" ||
      key === "menu_disposals.delete" ||
      key === "records.edit_date",
    hasAnyFeature: (keys) =>
      keys.some(
        (key) =>
          key === "menu_disposals.view" ||
          key === "menu_disposals.delete" ||
          key === "records.edit_date",
      ),
  });
}

const sampleSummary = {
  period: "daily" as const,
  date_from: "2026-01-01T00:00:00.000Z",
  date_to: "2026-01-31T23:59:59.999Z",
  totals: { count: 2, total_amount: 50_000, total_quantity: 3 },
  buckets: [
    {
      period_start: "2026-01-15T00:00:00Z",
      period_label: "Jan 15",
      count: 1,
      total_amount: 30_000,
      total_quantity: 2,
    },
  ],
};

const sampleByMenu = {
  period: "daily" as const,
  date_from: "2026-01-01T00:00:00.000Z",
  date_to: "2026-01-31T23:59:59.999Z",
  total_loss_amount: 50_000,
  total_quantity: 3,
  total_count: 2,
  menus: [
    {
      menu_id: "menu-1",
      menu_title: "Summary Menu A",
      disposal_count: 1,
      quantity_disposed: 2,
      loss_amount: 35_000,
      loss_share_percent: 70,
      quantity_share_percent: 66.7,
    },
  ],
};

function mockSummaryApis() {
  vi.mocked(menuDisposalsAdminApi.summary).mockResolvedValue({
    data: sampleSummary,
  });
  vi.mocked(menuDisposalsAdminApi.summaryByMenu).mockResolvedValue({
    data: sampleByMenu,
  });
}

describe("AdminMenuDisposalsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockManagerFeatures();
    mockSummaryApis();
    vi.mocked(menuDisposalsAdminApi.list).mockResolvedValue({
      data: [disposal1, disposal2],
      meta: { page: 1, per_page: 10, total: 2 },
    });
  });

  it("renders summary section above the disposal table", async () => {
    renderWithProviders(<AdminMenuDisposalsPage />);

    const summarySection = await screen.findByTestId(
      "menu-disposal-summary-section",
    );
    const tableRow = await screen.findByTestId("menu-disposal-row-disposal-1");

    expect(summarySection.compareDocumentPosition(tableRow)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.getByText("Disposal summary")).toBeInTheDocument();
  });

  it("renders disposals from the API with formatted amounts", async () => {
    renderWithProviders(<AdminMenuDisposalsPage />);

    expect(await screen.findByText("Menu Disposals")).toBeInTheDocument();
    expect(await screen.findByText("2 total")).toBeInTheDocument();
    expect(
      screen.getByTestId("menu-disposal-row-disposal-1"),
    ).toHaveTextContent("Nasi Goreng");
    expect(
      screen.getByTestId("menu-disposal-row-disposal-2"),
    ).toHaveTextContent("Mie Goreng");
    expect(screen.getByText("Rp 15.000")).toBeInTheDocument();
    expect(screen.getByText("Rp 30.000")).toBeInTheDocument();
    expect(screen.getAllByText("Rp 20.000")).toHaveLength(2);
    expect(screen.getByText("manager")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  it("shows empty state when no disposals match", async () => {
    vi.mocked(menuDisposalsAdminApi.list).mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 10, total: 0 },
    });

    renderWithProviders(<AdminMenuDisposalsPage />);

    expect(
      await screen.findByText("No menu disposals found."),
    ).toBeInTheDocument();
  });

  it("reloads with search and custom date filters", async () => {
    const user = userEvent.setup();

    renderWithProviders(<AdminMenuDisposalsPage />);
    await screen.findByText("Nasi Goreng");

    await user.type(
      screen.getByTestId("menu-disposals-search-input"),
      "nasi",
    );
    await user.selectOptions(
      screen.getByTestId("menu-disposals-date-preset"),
      "custom",
    );
    await user.type(screen.getByTestId("menu-disposals-date-from"), "2026-01-15");
    await user.type(screen.getByTestId("menu-disposals-date-to"), "2026-01-15");

    await waitFor(() => {
      expect(menuDisposalsAdminApi.list).toHaveBeenLastCalledWith({
        page: 1,
        perPage: 10,
        search: "nasi",
        dateFrom: "2026-01-15",
        dateTo: "2026-01-15",
      });
    });
  });

  it("does not show delete actions without menu_disposals.delete", async () => {
    renderWithProviders(<AdminMenuDisposalsPage />);
    await screen.findByText("Nasi Goreng");

    expect(
      screen.queryByTestId("menu-disposal-delete-disposal-1"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Actions")).not.toBeInTheDocument();
  });

  it("does not show edit date action without records.edit_date", async () => {
    renderWithProviders(<AdminMenuDisposalsPage />);
    await screen.findByText("Nasi Goreng");

    expect(
      screen.queryByTestId("menu-disposal-edit-date-disposal-1"),
    ).not.toBeInTheDocument();
  });

  it("shows edit date action for admin with records.edit_date", async () => {
    mockAdminEditDateFeatures();

    renderWithProviders(<AdminMenuDisposalsPage />);
    await screen.findByText("Nasi Goreng");

    expect(
      screen.getByTestId("menu-disposal-edit-date-disposal-1"),
    ).toBeInTheDocument();
  });

  it("saves corrected disposal date and refreshes list", async () => {
    const user = userEvent.setup();
    mockAdminEditDateFeatures();

    const updatedDisposal1: MenuDisposal = {
      ...disposal1,
      disposed_at: "2025-12-15T00:00:00.000Z",
    };

    vi.mocked(menuDisposalsAdminApi.updateDisposedDate).mockResolvedValue({
      data: updatedDisposal1,
    });
    vi.mocked(menuDisposalsAdminApi.list)
      .mockResolvedValueOnce({
        data: [disposal1, disposal2],
        meta: { page: 1, per_page: 10, total: 2 },
      })
      .mockResolvedValueOnce({
        data: [updatedDisposal1, disposal2],
        meta: { page: 1, per_page: 10, total: 2 },
      });

    renderWithProviders(<AdminMenuDisposalsPage />);
    await screen.findByText("Nasi Goreng");

    await user.click(screen.getByTestId("menu-disposal-edit-date-disposal-1"));
    expect(screen.getByTestId("menu-disposal-edit-date-dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Disposal date")).toHaveValue("2026-01-15");

    const dateInput = screen.getByTestId("menu-disposal-edit-date-input");
    await user.clear(dateInput);
    await user.type(dateInput, "2025-12-15");
    await user.click(screen.getByTestId("menu-disposal-edit-date-save"));

    await waitFor(() => {
      expect(menuDisposalsAdminApi.updateDisposedDate).toHaveBeenCalledWith(
        "disposal-1",
        startOfDayWIB("2025-12-15").toISOString(),
      );
      expect(toast.success).toHaveBeenCalledWith("Disposal date updated");
    });
  });

  it("date filter reflects corrected disposal date after save", async () => {
    const user = userEvent.setup();
    mockAdminEditDateFeatures();

    const updatedDisposal1: MenuDisposal = {
      ...disposal1,
      disposed_at: "2025-12-15T00:00:00.000Z",
    };

    vi.mocked(menuDisposalsAdminApi.updateDisposedDate).mockResolvedValue({
      data: updatedDisposal1,
    });
    vi.mocked(menuDisposalsAdminApi.list)
      .mockResolvedValueOnce({
        data: [disposal1, disposal2],
        meta: { page: 1, per_page: 10, total: 2 },
      })
      .mockResolvedValueOnce({
        data: [updatedDisposal1, disposal2],
        meta: { page: 1, per_page: 10, total: 2 },
      })
      .mockResolvedValueOnce({
        data: [updatedDisposal1],
        meta: { page: 1, per_page: 10, total: 1 },
      });

    renderWithProviders(<AdminMenuDisposalsPage />);
    await screen.findByText("Nasi Goreng");

    await user.click(screen.getByTestId("menu-disposal-edit-date-disposal-1"));
    const dateInput = screen.getByTestId("menu-disposal-edit-date-input");
    await user.clear(dateInput);
    await user.type(dateInput, "2025-12-15");
    await user.click(screen.getByTestId("menu-disposal-edit-date-save"));

    await waitFor(() => {
      expect(menuDisposalsAdminApi.updateDisposedDate).toHaveBeenCalled();
    });

    await user.selectOptions(
      screen.getByTestId("menu-disposals-date-preset"),
      "custom",
    );
    await user.type(screen.getByTestId("menu-disposals-date-from"), "2025-12-15");
    await user.type(screen.getByTestId("menu-disposals-date-to"), "2025-12-15");

    await waitFor(() => {
      expect(menuDisposalsAdminApi.list).toHaveBeenLastCalledWith({
        page: 1,
        perPage: 10,
        search: "",
        dateFrom: "2025-12-15",
        dateTo: "2025-12-15",
      });
    });
  });

  it("shows delete confirmation and removes disposal on confirm", async () => {
    const user = userEvent.setup();
    mockAdminDeleteFeatures();

    vi.mocked(menuDisposalsAdminApi.delete).mockResolvedValue({
      data: undefined,
    });
    vi.mocked(menuDisposalsAdminApi.list)
      .mockResolvedValueOnce({
        data: [disposal1, disposal2],
        meta: { page: 1, per_page: 10, total: 2 },
      })
      .mockResolvedValueOnce({
        data: [disposal2],
        meta: { page: 1, per_page: 10, total: 1 },
      });

    renderWithProviders(<AdminMenuDisposalsPage />);
    await screen.findByText("Nasi Goreng");

    await user.click(screen.getByTestId("menu-disposal-delete-disposal-1"));
    expect(
      screen.getByText("Delete disposal and restore stock?"),
    ).toBeInTheDocument();

    await user.click(screen.getByTestId("menu-disposal-delete-confirm"));

    await waitFor(() => {
      expect(menuDisposalsAdminApi.delete).toHaveBeenCalledWith("disposal-1");
      expect(toast.success).toHaveBeenCalledWith(
        "Disposal deleted and stock restored",
      );
    });

    await waitFor(() => {
      expect(
        screen.queryByTestId("menu-disposal-row-disposal-1"),
      ).not.toBeInTheDocument();
      expect(screen.getByText("1 total")).toBeInTheDocument();
    });
  });

  it("keeps table filters independent from summary period controls", async () => {
    const user = userEvent.setup();

    renderWithProviders(<AdminMenuDisposalsPage />);
    await screen.findByText("Nasi Goreng");

    await user.click(screen.getByRole("button", { name: "Weekly" }));

    await waitFor(() => {
      expect(menuDisposalsAdminApi.summary).toHaveBeenLastCalledWith(
        expect.objectContaining({ period: "weekly" }),
      );
    });

    const listCallsBeforeTableFilter = vi.mocked(menuDisposalsAdminApi.list).mock
      .calls.length;

    await user.selectOptions(
      screen.getByTestId("menu-disposals-date-preset"),
      "custom",
    );
    await user.type(screen.getByTestId("menu-disposals-date-from"), "2026-01-15");
    await user.type(screen.getByTestId("menu-disposals-date-to"), "2026-01-15");

    await waitFor(() => {
      expect(menuDisposalsAdminApi.list).toHaveBeenLastCalledWith({
        page: 1,
        perPage: 10,
        search: "",
        dateFrom: "2026-01-15",
        dateTo: "2026-01-15",
      });
    });

    const listCalls = vi.mocked(menuDisposalsAdminApi.list).mock.calls;
    for (const call of listCalls) {
      expect(call[0]).not.toHaveProperty("period");
    }
    expect(listCalls.length).toBeGreaterThan(listCallsBeforeTableFilter);
  });

  it("shows error toast when loading fails", async () => {
    vi.mocked(menuDisposalsAdminApi.list).mockRejectedValue(
      new ApiError(500, "server_error", "Server error"),
    );

    renderWithProviders(<AdminMenuDisposalsPage />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Server error");
    });
  });
});

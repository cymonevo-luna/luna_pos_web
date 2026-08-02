import { describe, it, expect, vi, beforeEach } from "vitest";
import { menuDisposalsAdminApi } from "./menu-disposals";
import { api } from "./client";

vi.mock("./client", () => ({
  api: {
    get: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

describe("menuDisposalsAdminApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists menu disposals with pagination, search, date filters, and sort", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [
        {
          id: "disposal-1",
          menu_id: "menu-1",
          menu_title: "Nasi Goreng",
          quantity: "2",
          unit_loss_amount: "15000",
          loss_amount: "30000",
          disposed_by_username: "manager",
          disposed_at: "2026-01-15T10:30:00Z",
          created_at: "2026-01-15T10:30:00Z",
          updated_at: "2026-01-15T10:30:00Z",
        },
      ],
      meta: { page: 1, per_page: 10, total: 1 },
    });

    const result = await menuDisposalsAdminApi.list({
      page: 2,
      perPage: 20,
      search: "nasi",
      dateFrom: "2026-01-15",
      dateTo: "2026-01-16",
    });

    expect(api.get).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/menu-disposals?"),
    );
    const url = vi.mocked(api.get).mock.calls[0][0] as string;
    expect(url).toContain("page=2");
    expect(url).toContain("per_page=20");
    expect(url).toContain("search=nasi");
    expect(url).toContain("sort=disposed_at");
    expect(url).toContain("order=desc");
    expect(url).toContain("date_from=");
    expect(url).toContain("date_to=");
    expect(result.data[0].quantity).toBe(2);
    expect(result.data[0].unit_loss_amount).toBe(15000);
    expect(result.data[0].loss_amount).toBe(30000);
  });

  it("deletes a menu disposal by id", async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: undefined });

    await menuDisposalsAdminApi.delete("disposal-1");

    expect(api.delete).toHaveBeenCalledWith(
      "/api/admin/menu-disposals/disposal-1",
    );
  });

  it("updates disposed_at via record-date endpoint", async () => {
    vi.mocked(api.patch).mockResolvedValue({
      data: {
        id: "disposal-1",
        menu_id: "menu-1",
        menu_title: "Nasi Goreng",
        quantity: "2",
        unit_loss_amount: "15000",
        loss_amount: "30000",
        disposed_by_username: "manager",
        disposed_at: "2025-12-15T00:00:00.000Z",
        created_at: "2026-01-15T10:30:00Z",
        updated_at: "2026-01-15T10:30:00Z",
      },
    });

    const result = await menuDisposalsAdminApi.updateDisposedDate(
      "disposal-1",
      "2025-12-15T00:00:00.000Z",
    );

    expect(api.patch).toHaveBeenCalledWith(
      "/api/admin/menu-disposals/disposal-1/record-date",
      { disposed_at: "2025-12-15T00:00:00.000Z" },
    );
    expect(result.data.disposed_at).toBe("2025-12-15T00:00:00.000Z");
    expect(result.data.quantity).toBe(2);
  });

  it("builds the correct summary URL", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        period: "weekly",
        date_from: "2026-01-01T00:00:00.000Z",
        date_to: "2026-01-31T23:59:59.999Z",
        totals: {
          count: "0",
          total_amount: "0",
          total_quantity: "0",
        },
        buckets: [],
      },
    });

    await menuDisposalsAdminApi.summary({
      period: "weekly",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    });

    expect(api.get).toHaveBeenCalledWith(
      "/api/admin/menu-disposals/summary?period=weekly&date_from=2026-01-01&date_to=2026-01-31",
    );
  });

  it("normalizes string amounts in summaryByMenu response", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        period: "daily",
        date_from: "2026-01-01T00:00:00.000Z",
        date_to: "2026-01-01T23:59:59.999Z",
        total_loss_amount: "50000",
        total_quantity: "3",
        total_count: "2",
        menus: [
          {
            menu_id: "menu-1",
            menu_title: "Nasi Goreng",
            disposal_count: "2",
            quantity_disposed: "3",
            loss_amount: "50000",
            loss_share_percent: "100",
            quantity_share_percent: "100",
          },
        ],
      },
    });

    const result = await menuDisposalsAdminApi.summaryByMenu({
      period: "daily",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-01",
      limit: 10,
    });

    const url = vi.mocked(api.get).mock.calls[0][0] as string;
    expect(url).toContain("/api/admin/menu-disposals/summary/by-menu?");
    expect(url).toContain("period=daily");
    expect(url).toContain("date_from=2026-01-01");
    expect(url).toContain("date_to=2026-01-01");
    expect(url).toContain("limit=10");
    expect(result.data.total_loss_amount).toBe(50000);
    expect(result.data.menus[0].loss_amount).toBe(50000);
    expect(result.data.menus[0].disposal_count).toBe(2);
  });
});

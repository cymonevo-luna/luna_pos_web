import { describe, it, expect, vi, beforeEach } from "vitest";
import { menuDisposalsAdminApi } from "./menu-disposals";
import { api } from "./client";

vi.mock("./client", () => ({
  api: {
    get: vi.fn(),
    delete: vi.fn(),
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
});

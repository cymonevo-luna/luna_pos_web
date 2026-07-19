import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cogsAdminApi, downloadCogsCsv } from "./cogs";
import { tokenStore } from "@/lib/auth/tokens";
import {
  backendDetailFixture,
  backendPortfolioSummaryFixture,
  backendSummaryFixture,
} from "./cogs-mapper.fixtures";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("cogsAdminApi", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds the list URL with pagination, search, and category filters", async () => {
    tokenStore.set("token-abc", "refresh-abc");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: [],
        meta: { page: 2, per_page: 10, total: 0 },
      }),
    );

    await cogsAdminApi.list({
      page: 2,
      perPage: 10,
      search: "rendang",
      categoryId: "cat-1",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/cogs?page=2&per_page=10&search=rendang&category_id=cat-1",
    );
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
  });

  it("builds the list URL with sort query params", async () => {
    tokenStore.set("token-abc", "refresh-abc");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: [],
        meta: { page: 1, per_page: 10, total: 0 },
      }),
    );

    await cogsAdminApi.list({ sortBy: "status", sortOrder: "asc" });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("sort_by=status");
    expect(url).toContain("sort_order=asc");
  });

  it("normalizes backend-shaped COGS list responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: [backendSummaryFixture],
        meta: { page: 1, per_page: 10, total: 1 },
      }),
    );

    const res = await cogsAdminApi.list();
    expect(res.data[0]).toEqual({
      menu_id: "menu-rendang-uuid",
      title: "Rendang",
      category_id: "",
      category_name: "Main",
      cogs_per_piece: 15000,
      margin_percent: 30,
      vat_percent: 11,
      price_after_margin: 19500,
      price_after_vat: 21645,
      recommended_offline: 22000,
      recommended_online: 26400,
      sell_price: 25000,
      status: "complete",
    });
  });

  it("normalizes backend-shaped COGS detail for a menu", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, data: backendDetailFixture }),
    );

    const res = await cogsAdminApi.get("menu-rendang-uuid");
    expect(res.data.title).toBe("Rendang");
    expect(res.data.status).toBe("complete");
    expect(res.data.ingredients).toHaveLength(2);
    expect(res.data.ingredients[0]!.supplier_quotes).toHaveLength(2);
    expect(res.data.ingredients[0]!.supplier_quotes[1]!.selected).toBe(true);
    expect(res.data.total_cogs).toBe(600000);
  });

  it("downloads CSV export as a blob", async () => {
    tokenStore.set("token-abc", "refresh-abc");
    const csv = "menu,cogs\nRendang,15000";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(csv, {
        status: 200,
        headers: { "Content-Type": "text/csv" },
      }),
    );

    const blob = await cogsAdminApi.exportCsv();
    expect(await blob.text()).toBe(csv);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8080/api/admin/cogs/export");
  });

  it("fetches and normalizes portfolio summary", async () => {
    tokenStore.set("token-abc", "refresh-abc");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: backendPortfolioSummaryFixture,
      }),
    );

    const res = await cogsAdminApi.portfolioSummary();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/cogs/portfolio-summary",
    );
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");

    expect(res.data).toEqual({
      generated_at: "2026-07-18T03:00:00.000Z",
      total_menus: 5,
      complete_count: 3,
      missing_prices_count: 1,
      no_formula_count: 1,
      avg_margin_percent: 28.5,
      avg_cogs_per_piece: 12500,
      variance: {
        total_recommended_sell_price: 110000,
        total_current_sell_price: 125000,
        variance_amount: -15000,
        variance_percent: -12,
      },
      categories: [
        {
          category_id: "cat-main",
          category_name: "Main",
          menu_count: 3,
          complete_count: 2,
          avg_margin_percent: 30,
          avg_cogs_per_piece: 15000,
        },
        {
          category_id: "cat-drinks",
          category_name: "Drinks",
          menu_count: 2,
          complete_count: 1,
          avg_margin_percent: 25,
          avg_cogs_per_piece: 8000,
        },
      ],
    });
  });
});

describe("downloadCogsCsv", () => {
  it("creates a dated download link for the blob", () => {
    const click = vi.fn();
    const anchor = {
      href: "",
      download: "",
      click,
    } as unknown as HTMLAnchorElement;

    const createElement = vi
      .spyOn(document, "createElement")
      .mockReturnValue(anchor);
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:mock");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL");

    downloadCogsCsv(new Blob(["menu,cogs"]), new Date("2026-07-12T00:00:00Z"));

    expect(createElement).toHaveBeenCalledWith("a");
    expect(createObjectURL).toHaveBeenCalled();
    expect(anchor.download).toBe("cogs-export-2026-07-12.csv");
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });
});

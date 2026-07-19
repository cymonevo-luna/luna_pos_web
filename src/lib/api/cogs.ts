import { api, type ApiResult } from "./client";
import {
  normalizeCogsMenuDetail,
  normalizeCogsMenuSummary,
  normalizeCogsPortfolioSummary,
  type CogsMenuDetailRaw,
  type CogsMenuSummaryRaw,
  type CogsPortfolioSummaryRaw,
} from "./cogs-mapper";
import type {
  CogsMenuDetail,
  CogsMenuSummary,
  CogsPortfolioSummary,
} from "./types";

export type CogsSortBy =
  | "menu_title"
  | "margin"
  | "current_sell_price"
  | "status";
export type CogsSortOrder = "asc" | "desc";

export interface ListCogsParams {
  page?: number;
  perPage?: number;
  search?: string;
  categoryId?: string;
  sortBy?: CogsSortBy;
  sortOrder?: CogsSortOrder;
}

function normalizeListResult(
  result: ApiResult<CogsMenuSummaryRaw[]>,
): ApiResult<CogsMenuSummary[]> {
  return {
    ...result,
    data: result.data.map(normalizeCogsMenuSummary),
  };
}

function normalizeDetailResult(
  result: ApiResult<CogsMenuDetailRaw>,
): ApiResult<CogsMenuDetail> {
  return {
    ...result,
    data: normalizeCogsMenuDetail(result.data),
  };
}

function normalizePortfolioSummaryResult(
  result: ApiResult<CogsPortfolioSummaryRaw>,
): ApiResult<CogsPortfolioSummary> {
  return {
    ...result,
    data: normalizeCogsPortfolioSummary(result.data),
  };
}

export const cogsAdminApi = {
  list: async ({
    page = 1,
    perPage = 10,
    search = "",
    categoryId = "",
    sortBy,
    sortOrder,
  }: ListCogsParams = {}) => {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    if (search) params.set("search", search);
    if (categoryId) params.set("category_id", categoryId);
    if (sortBy) params.set("sort_by", sortBy);
    if (sortOrder) params.set("sort_order", sortOrder);
    const result = await api.get<CogsMenuSummaryRaw[]>(
      `/api/admin/cogs?${params.toString()}`,
    );
    return normalizeListResult(result);
  },

  get: async (menuId: string) => {
    const result = await api.get<CogsMenuDetailRaw>(
      `/api/admin/cogs/${menuId}`,
    );
    return normalizeDetailResult(result);
  },

  exportCsv: () => api.downloadBlob("/api/admin/cogs/export"),

  portfolioSummary: async () => {
    const result = await api.get<CogsPortfolioSummaryRaw>(
      "/api/admin/cogs/portfolio-summary",
    );
    return normalizePortfolioSummaryResult(result);
  },
};

/** Trigger a browser download for a CSV blob with a dated filename. */
export function downloadCogsCsv(blob: Blob, date = new Date()) {
  const stamp = date.toISOString().slice(0, 10);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `cogs-export-${stamp}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

import { api, type ApiResult } from "./client";
import {
  normalizeCogsMenuDetail,
  normalizeCogsMenuSummary,
  type CogsMenuDetailRaw,
  type CogsMenuSummaryRaw,
} from "./cogs-mapper";
import type { CogsMenuDetail, CogsMenuSummary } from "./types";

export interface ListCogsParams {
  page?: number;
  perPage?: number;
  search?: string;
  categoryId?: string;
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

export const cogsAdminApi = {
  list: async ({
    page = 1,
    perPage = 10,
    search = "",
    categoryId = "",
  }: ListCogsParams = {}) => {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    if (search) params.set("search", search);
    if (categoryId) params.set("category_id", categoryId);
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

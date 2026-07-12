import { api } from "./client";
import type { CogsMenuDetail, CogsMenuSummary } from "./types";

export interface ListCogsParams {
  page?: number;
  perPage?: number;
  search?: string;
  categoryId?: string;
}

export const cogsAdminApi = {
  list: ({
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
    return api.get<CogsMenuSummary[]>(`/api/admin/cogs?${params.toString()}`);
  },

  get: (menuId: string) =>
    api.get<CogsMenuDetail>(`/api/admin/cogs/${menuId}`),

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

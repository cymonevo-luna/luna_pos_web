import { api, type ApiResult } from "./client";
import { parseNumeric } from "./suppliers";
import { appendHistoryDateParams } from "./history-date-params";
import type {
  MenuDisposal,
  MenuDisposalByMenuItem,
  MenuDisposalByMenuItemRaw,
  MenuDisposalByMenuSummary,
  MenuDisposalByMenuSummaryRaw,
  MenuDisposalSummary,
  MenuDisposalSummaryBucket,
  MenuDisposalSummaryBucketRaw,
  MenuDisposalSummaryPeriod,
  MenuDisposalSummaryRaw,
  MenuDisposalSummaryTotals,
  MenuDisposalSummaryTotalsRaw,
} from "./types";

interface MenuDisposalRaw
  extends Omit<
    MenuDisposal,
    "quantity" | "unit_loss_amount" | "loss_amount"
  > {
  quantity: number | string;
  unit_loss_amount: number | string;
  loss_amount: number | string;
}

function normalizeMenuDisposal(raw: MenuDisposalRaw): MenuDisposal {
  return {
    ...raw,
    quantity: parseNumeric(raw.quantity),
    unit_loss_amount: parseNumeric(raw.unit_loss_amount),
    loss_amount: parseNumeric(raw.loss_amount),
  };
}

function normalizeListResult(
  result: ApiResult<MenuDisposalRaw[]>,
): ApiResult<MenuDisposal[]> {
  return {
    ...result,
    data: result.data.map(normalizeMenuDisposal),
  };
}

export interface ListMenuDisposalsParams {
  page?: number;
  perPage?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface MenuDisposalSummaryParams {
  period: MenuDisposalSummaryPeriod;
  dateFrom?: string;
  dateTo?: string;
}

export interface MenuDisposalSummaryByMenuParams extends MenuDisposalSummaryParams {
  limit?: number;
}

function normalizeMenuDisposalSummaryBucket(
  raw: MenuDisposalSummaryBucketRaw,
): MenuDisposalSummaryBucket {
  return {
    ...raw,
    count: parseNumeric(raw.count),
    total_amount: parseNumeric(raw.total_amount),
    total_quantity: parseNumeric(raw.total_quantity),
  };
}

function normalizeMenuDisposalSummaryTotals(
  raw: MenuDisposalSummaryTotalsRaw,
): MenuDisposalSummaryTotals {
  return {
    count: parseNumeric(raw.count),
    total_amount: parseNumeric(raw.total_amount),
    total_quantity: parseNumeric(raw.total_quantity),
  };
}

function normalizeMenuDisposalSummary(raw: MenuDisposalSummaryRaw): MenuDisposalSummary {
  return {
    ...raw,
    totals: normalizeMenuDisposalSummaryTotals(raw.totals),
    buckets: raw.buckets.map(normalizeMenuDisposalSummaryBucket),
  };
}

function normalizeMenuDisposalSummaryResult(
  result: ApiResult<MenuDisposalSummaryRaw>,
): ApiResult<MenuDisposalSummary> {
  return {
    ...result,
    data: normalizeMenuDisposalSummary(result.data),
  };
}

function normalizeMenuDisposalByMenuItem(
  raw: MenuDisposalByMenuItemRaw,
): MenuDisposalByMenuItem {
  return {
    ...raw,
    disposal_count: parseNumeric(raw.disposal_count),
    quantity_disposed: parseNumeric(raw.quantity_disposed),
    loss_amount: parseNumeric(raw.loss_amount),
    loss_share_percent: parseNumeric(raw.loss_share_percent),
    quantity_share_percent: parseNumeric(raw.quantity_share_percent),
  };
}

function normalizeMenuDisposalByMenuSummary(
  raw: MenuDisposalByMenuSummaryRaw,
): MenuDisposalByMenuSummary {
  return {
    ...raw,
    total_loss_amount: parseNumeric(raw.total_loss_amount),
    total_quantity: parseNumeric(raw.total_quantity),
    total_count: parseNumeric(raw.total_count),
    menus: raw.menus.map(normalizeMenuDisposalByMenuItem),
  };
}

function normalizeMenuDisposalByMenuSummaryResult(
  result: ApiResult<MenuDisposalByMenuSummaryRaw>,
): ApiResult<MenuDisposalByMenuSummary> {
  return {
    ...result,
    data: normalizeMenuDisposalByMenuSummary(result.data),
  };
}

function buildMenuDisposalSummaryParams({
  period,
  dateFrom = "",
  dateTo = "",
}: MenuDisposalSummaryParams) {
  const params = new URLSearchParams({ period });
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  return params;
}

export const menuDisposalsAdminApi = {
  list: async ({
    page = 1,
    perPage = 10,
    search = "",
    dateFrom = "",
    dateTo = "",
  }: ListMenuDisposalsParams = {}) => {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
      sort: "disposed_at",
      order: "desc",
    });
    if (search) params.set("search", search);
    appendHistoryDateParams(params, dateFrom, dateTo);

    const result = await api.get<MenuDisposalRaw[]>(
      `/api/admin/menu-disposals?${params.toString()}`,
    );
    return normalizeListResult(result);
  },

  get: async (id: string) => {
    const result = await api.get<MenuDisposalRaw>(
      `/api/admin/menu-disposals/${id}`,
    );
    return {
      ...result,
      data: normalizeMenuDisposal(result.data),
    };
  },

  delete: (id: string) =>
    api.delete<void>(`/api/admin/menu-disposals/${id}`),

  updateDisposedDate: async (id: string, disposedAt: string) => {
    const result = await api.patch<MenuDisposalRaw>(
      `/api/admin/menu-disposals/${id}/record-date`,
      { disposed_at: disposedAt },
    );
    return {
      ...result,
      data: normalizeMenuDisposal(result.data),
    };
  },

  summary: async (params: MenuDisposalSummaryParams) => {
    const query = buildMenuDisposalSummaryParams(params);
    const result = await api.get<MenuDisposalSummaryRaw>(
      `/api/admin/menu-disposals/summary?${query.toString()}`,
    );
    return normalizeMenuDisposalSummaryResult(result);
  },

  summaryByMenu: async ({
    period,
    dateFrom = "",
    dateTo = "",
    limit,
  }: MenuDisposalSummaryByMenuParams) => {
    const params = buildMenuDisposalSummaryParams({
      period,
      dateFrom,
      dateTo,
    });
    if (limit != null) params.set("limit", String(limit));
    const result = await api.get<MenuDisposalByMenuSummaryRaw>(
      `/api/admin/menu-disposals/summary/by-menu?${params.toString()}`,
    );
    return normalizeMenuDisposalByMenuSummaryResult(result);
  },
};

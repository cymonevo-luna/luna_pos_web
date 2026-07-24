import { api, type ApiResult } from "./client";
import { parseNumeric } from "./suppliers";
import { dateInputToIso } from "./transactions";
import type { MenuDisposal } from "./types";

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
    if (dateFrom) params.set("date_from", dateInputToIso(dateFrom, false));
    if (dateTo) params.set("date_to", dateInputToIso(dateTo, true));

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
};

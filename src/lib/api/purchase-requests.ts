import { api, type ApiResult } from "./client";
import { parseNumeric } from "./suppliers";
import type {
  PurchaseRequest,
  PurchaseRequestItem,
  PurchaseRequestStatus,
  PurchaseRequestSummary,
} from "./types";
import type { PurchaseRequestFormValues } from "@/lib/validations";

/** Wire format from the Go backend (`decimal.Decimal` marshals as JSON string). */
interface PurchaseRequestItemRaw
  extends Omit<
    PurchaseRequestItem,
    "quantity" | "price_quantity" | "unit_price" | "price_amount" | "line_estimated_amount"
  > {
  quantity: number | string;
  price_quantity: number | string;
  unit_price: number | string;
  price_amount: number | string;
  line_estimated_amount: number | string;
}

interface PurchaseRequestRaw
  extends Omit<PurchaseRequest, "items" | "total_estimated_amount"> {
  items: PurchaseRequestItemRaw[];
  total_estimated_amount: number | string;
}

interface PurchaseRequestSummaryRaw
  extends Omit<PurchaseRequestSummary, "total_estimated_amount"> {
  total_estimated_amount: number | string;
}

export function normalizePurchaseRequestItem(
  raw: PurchaseRequestItemRaw,
): PurchaseRequestItem {
  return {
    ...raw,
    quantity: parseNumeric(raw.quantity),
    price_quantity: parseNumeric(raw.price_quantity),
    unit_price: parseNumeric(raw.unit_price),
    price_amount: parseNumeric(raw.price_amount),
    line_estimated_amount: parseNumeric(raw.line_estimated_amount),
  };
}

export function normalizePurchaseRequest(
  raw: PurchaseRequestRaw,
): PurchaseRequest {
  return {
    ...raw,
    total_estimated_amount: parseNumeric(raw.total_estimated_amount),
    items: (raw.items ?? []).map(normalizePurchaseRequestItem),
  };
}

function normalizePurchaseRequestSummary(
  raw: PurchaseRequestSummaryRaw,
): PurchaseRequestSummary {
  return {
    ...raw,
    total_estimated_amount: parseNumeric(raw.total_estimated_amount),
  };
}

function normalizeListResult(
  result: ApiResult<PurchaseRequestSummaryRaw[]>,
): ApiResult<PurchaseRequestSummary[]> {
  return {
    ...result,
    data: result.data.map(normalizePurchaseRequestSummary),
  };
}

function normalizeItemResult(
  result: ApiResult<PurchaseRequestRaw>,
): ApiResult<PurchaseRequest> {
  return {
    ...result,
    data: normalizePurchaseRequest(result.data),
  };
}

export interface ListPurchaseRequestsParams {
  page?: number;
  perPage?: number;
  status?: PurchaseRequestStatus | "";
}

export interface CreatePurchaseRequestItemPayload {
  food_supply_id: string;
  quantity: string;
}

export interface CreatePurchaseRequestPayload {
  supplier_id: string;
  items: CreatePurchaseRequestItemPayload[];
  notes?: string;
}

/** Map form values to an API payload with decimal string quantities. */
export function purchaseRequestFormToPayload(
  values: PurchaseRequestFormValues,
): CreatePurchaseRequestPayload {
  const payload: CreatePurchaseRequestPayload = {
    supplier_id: values.supplier_id,
    items: values.items.map((item) => ({
      food_supply_id: item.food_supply_id,
      quantity: String(item.quantity),
    })),
  };

  const notes = values.notes?.trim();
  if (notes) {
    payload.notes = notes;
  }

  return payload;
}

export const purchaseRequestsAdminApi = {
  list: async ({
    page = 1,
    perPage = 10,
    status = "",
  }: ListPurchaseRequestsParams = {}) => {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    if (status) params.set("status", status);
    const result = await api.get<PurchaseRequestSummaryRaw[]>(
      `/api/admin/purchase-requests?${params.toString()}`,
    );
    return normalizeListResult(result);
  },

  get: async (id: string) => {
    const result = await api.get<PurchaseRequestRaw>(
      `/api/admin/purchase-requests/${id}`,
    );
    return normalizeItemResult(result);
  },

  create: async (payload: CreatePurchaseRequestPayload) => {
    const result = await api.post<PurchaseRequestRaw>(
      "/api/admin/purchase-requests",
      payload,
    );
    return normalizeItemResult(result);
  },

  updateStatus: async (
    id: string,
    payload: UpdatePurchaseStatusPayload,
  ) => {
    const result = await api.patch<PurchaseRequestRaw>(
      `/api/admin/purchase-requests/${id}/status`,
      payload,
    );
    return normalizeItemResult(result);
  },
};

export interface UpdatePurchaseStatusPayload {
  status: PurchaseRequestStatus;
  photo_url?: string;
}

/** Advance purchase request status (optionally with proof photo URL). */
export const updatePurchaseStatus = purchaseRequestsAdminApi.updateStatus;

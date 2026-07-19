import { api, type ApiResult } from "./client";
import { parseNumeric } from "./suppliers";
import type {
  BatchPurchaseRequestsResponse,
  PurchaseRequest,
  PurchaseRequestItem,
  PurchaseRequestStatus,
  PurchaseRequestStatusHistoryEntry,
  PurchaseRequestSuggestItem,
  PurchaseRequestSuggestResponse,
  PurchaseRequestSummary,
  PurchaseRequestSupplierQuote,
} from "./types";
import type {
  PurchaseRequestFormValues,
  SmartPurchaseIngredientsFormValues,
} from "@/lib/validations";
import type { BatchPurchaseRequestsPayload } from "./smart-purchase-utils";

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
  extends Omit<
    PurchaseRequest,
    "items" | "total_estimated_amount" | "status_history"
  > {
  items: PurchaseRequestItemRaw[];
  total_estimated_amount: number | string;
  status_history?: PurchaseRequestStatusHistoryEntry[];
}

interface PurchaseRequestSummaryRaw
  extends Omit<PurchaseRequestSummary, "total_estimated_amount"> {
  total_estimated_amount: number | string;
}

interface PurchaseRequestSupplierQuoteRaw
  extends Omit<PurchaseRequestSupplierQuote, "price_amount" | "price_quantity" | "unit_price"> {
  price_amount: number | string;
  price_quantity: number | string;
  unit_price: number | string;
}

interface PurchaseRequestSuggestItemRaw
  extends Omit<
    PurchaseRequestSuggestItem,
    | "quantity"
    | "price_amount"
    | "price_quantity"
    | "unit_price"
    | "line_estimated_amount"
    | "all_supplier_quotes"
  > {
  quantity: number | string;
  price_amount: number | string;
  price_quantity: number | string;
  unit_price: number | string;
  line_estimated_amount: number | string;
  all_supplier_quotes?: PurchaseRequestSupplierQuoteRaw[];
}

interface PurchaseRequestSuggestResponseRaw
  extends Omit<PurchaseRequestSuggestResponse, "items" | "grouped_by_supplier"> {
  items: PurchaseRequestSuggestItemRaw[];
  grouped_by_supplier: Array<
    Omit<
      PurchaseRequestSuggestResponse["grouped_by_supplier"][number],
      "items" | "group_total_estimated_amount"
    > & {
      items: PurchaseRequestSuggestItemRaw[];
      group_total_estimated_amount?: number | string;
    }
  >;
}

interface BatchPurchaseRequestsResponseRaw {
  purchase_requests: PurchaseRequestRaw[];
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
    status_history: raw.status_history ?? [],
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

export function normalizePurchaseRequestSupplierQuote(
  raw: PurchaseRequestSupplierQuoteRaw,
): PurchaseRequestSupplierQuote {
  return {
    ...raw,
    price_amount: parseNumeric(raw.price_amount),
    price_quantity: parseNumeric(raw.price_quantity),
    unit_price: parseNumeric(raw.unit_price),
  };
}

export function normalizePurchaseRequestSuggestItem(
  raw: PurchaseRequestSuggestItemRaw,
): PurchaseRequestSuggestItem {
  return {
    ...raw,
    quantity: parseNumeric(raw.quantity),
    price_amount: parseNumeric(raw.price_amount),
    price_quantity: parseNumeric(raw.price_quantity),
    unit_price: parseNumeric(raw.unit_price),
    line_estimated_amount: parseNumeric(raw.line_estimated_amount),
    all_supplier_quotes: (raw.all_supplier_quotes ?? []).map(
      normalizePurchaseRequestSupplierQuote,
    ),
  };
}

export function normalizePurchaseRequestSuggestResponse(
  raw: PurchaseRequestSuggestResponseRaw,
): PurchaseRequestSuggestResponse {
  return {
    items: (raw.items ?? []).map(normalizePurchaseRequestSuggestItem),
    grouped_by_supplier: (raw.grouped_by_supplier ?? []).map((group) => ({
      ...group,
      items: (group.items ?? []).map(normalizePurchaseRequestSuggestItem),
      group_total_estimated_amount:
        group.group_total_estimated_amount == null
          ? undefined
          : parseNumeric(group.group_total_estimated_amount),
    })),
  };
}

function normalizeBatchResult(
  result: ApiResult<BatchPurchaseRequestsResponseRaw>,
): ApiResult<BatchPurchaseRequestsResponse> {
  return {
    ...result,
    data: {
      purchase_requests: (result.data.purchase_requests ?? []).map(
        normalizePurchaseRequest,
      ),
    },
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

export interface SuggestPurchaseRequestsPayload {
  items: CreatePurchaseRequestItemPayload[];
}

/** Map ingredient form values to a suggest API payload. */
export function smartPurchaseIngredientsToPayload(
  values: SmartPurchaseIngredientsFormValues,
): SuggestPurchaseRequestsPayload {
  return {
    items: values.items.map((item) => ({
      food_supply_id: item.food_supply_id,
      quantity: String(item.quantity),
    })),
  };
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

  suggest: async (payload: SuggestPurchaseRequestsPayload) => {
    const result = await api.post<PurchaseRequestSuggestResponseRaw>(
      "/api/admin/purchase-requests/suggest",
      payload,
    );
    return {
      ...result,
      data: normalizePurchaseRequestSuggestResponse(result.data),
    };
  },

  batch: async (payload: BatchPurchaseRequestsPayload) => {
    const result = await api.post<BatchPurchaseRequestsResponseRaw>(
      "/api/admin/purchase-requests/batch",
      payload,
    );
    return normalizeBatchResult(result);
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

  delete: (id: string) =>
    api.delete<void>(`/api/admin/purchase-requests/${id}`),
};

export interface UpdatePurchaseStatusPayload {
  status: PurchaseRequestStatus;
  proof_url?: string;
}

/** Advance purchase request status (optionally with proof photo URL). */
export const updatePurchaseStatus = purchaseRequestsAdminApi.updateStatus;

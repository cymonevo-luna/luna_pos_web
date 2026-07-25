import { config } from "@/lib/config";
import {
  clearSessionAndRedirectToLogin,
  ensureFreshAccessToken,
  isLoginRoute,
  performSessionRefresh,
} from "@/lib/auth/session-refresh";
import { tokenStore } from "@/lib/auth/tokens";
import { startOfDayWIB } from "@/lib/datetime/wib";
import { api, ApiError, type ApiResult } from "./client";
import type { Envelope } from "./types";
import { appendHistoryDateParams } from "./history-date-params";
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
    | "quantity"
    | "price_quantity"
    | "unit_price"
    | "price_amount"
    | "line_estimated_amount"
    | "line_actual_amount"
  > {
  quantity: number | string;
  price_quantity: number | string;
  unit_price: number | string;
  price_amount: number | string;
  line_estimated_amount: number | string;
  line_actual_amount?: number | string | null;
}

interface PurchaseRequestRaw
  extends Omit<
    PurchaseRequest,
    "items" | "total_estimated_amount" | "total_actual_amount" | "status_history"
  > {
  items: PurchaseRequestItemRaw[];
  total_estimated_amount: number | string;
  total_actual_amount?: number | string | null;
  status_history?: PurchaseRequestStatusHistoryEntry[];
}

interface PurchaseRequestSummaryRaw
  extends Omit<PurchaseRequestSummary, "total_estimated_amount" | "total_actual_amount"> {
  total_estimated_amount: number | string;
  total_actual_amount?: number | string | null;
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
    line_actual_amount:
      raw.line_actual_amount == null
        ? raw.line_actual_amount
        : parseNumeric(raw.line_actual_amount),
  };
}

export function normalizePurchaseRequest(
  raw: PurchaseRequestRaw,
): PurchaseRequest {
  return {
    ...raw,
    total_estimated_amount: parseNumeric(raw.total_estimated_amount),
    total_actual_amount:
      raw.total_actual_amount == null
        ? raw.total_actual_amount
        : parseNumeric(raw.total_actual_amount),
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
    total_actual_amount:
      raw.total_actual_amount == null
        ? raw.total_actual_amount
        : parseNumeric(raw.total_actual_amount),
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
  dateFrom?: string;
  dateTo?: string;
}

export interface ExportPurchaseRequestsCsvParams {
  transactionDate: string;
  status?: PurchaseRequestStatus;
}

export interface CreatePurchaseRequestItemPayload {
  food_supply_id: string;
  quantity: string;
  line_actual_amount?: number;
  supplier_price_update?: {
    price_amount: number;
    price_quantity: number;
  };
}

export interface CreatePurchaseRequestPayload {
  supplier_id: string;
  items: CreatePurchaseRequestItemPayload[];
  notes?: string;
  transaction_date?: string;
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
    items: values.items.map((item) => {
      const line: CreatePurchaseRequestItemPayload = {
        food_supply_id: item.food_supply_id,
        quantity: String(item.quantity),
      };

      if (item.line_actual_amount != null) {
        line.line_actual_amount = item.line_actual_amount;
      }

      if (item.update_supplier_price && item.supplier_price_update) {
        line.supplier_price_update = {
          price_amount: item.supplier_price_update.price_amount,
          price_quantity: item.supplier_price_update.price_quantity,
        };
      }

      return line;
    }),
  };

  const notes = values.notes?.trim();
  if (notes) {
    payload.notes = notes;
  }

  payload.transaction_date = startOfDayWIB(values.transactionDate).toISOString();

  return payload;
}

export const purchaseRequestsAdminApi = {
  list: async ({
    page = 1,
    perPage = 10,
    status = "",
    dateFrom = "",
    dateTo = "",
  }: ListPurchaseRequestsParams = {}) => {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    if (status) params.set("status", status);
    appendHistoryDateParams(params, dateFrom, dateTo);
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

  updatePaidDate: async (id: string, paidAt: string) => {
    const result = await api.patch<PurchaseRequestRaw>(
      `/api/admin/purchase-requests/${id}/record-date`,
      { paid_at: paidAt },
    );
    return normalizeItemResult(result);
  },
};

/** Export purchase request line items as CSV for a transaction date. */
export async function exportPurchaseRequestsCsv({
  transactionDate,
  status,
}: ExportPurchaseRequestsCsvParams) {
  const params = new URLSearchParams({
    transaction_date: transactionDate,
  });
  if (status) {
    params.set("status", status);
  }
  return api.downloadBlobResult(
    `/api/admin/purchase-requests/export?${params.toString()}`,
  );
}

export interface PurchaseImportSupplierProofs {
  paid_proof_url?: string;
  delivered_proof_url?: string;
}

export type PurchaseImportProofsMap = Record<string, PurchaseImportSupplierProofs>;

export interface ImportPurchaseRequestsCsvParams {
  file: File;
  transactionDate: string;
  targetStatus: PurchaseRequestStatus;
  proofs?: PurchaseImportProofsMap;
}

export interface ImportPurchaseRequestsCsvResult {
  created_count: number;
}

/** Download the purchase import CSV template. */
export async function downloadPurchaseImportTemplate() {
  return api.downloadBlobResult(
    "/api/admin/purchase-requests/import/template",
  );
}

/** Trigger a browser download for the purchase import template blob. */
export function downloadPurchaseImportTemplateFile(
  blob: Blob,
  options: { filename?: string } = {},
) {
  const { filename } = options;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename ?? "purchase-requests-import-template.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

async function importPurchaseRequestsCsvRequest(
  params: ImportPurchaseRequestsCsvParams,
  _retried = false,
): Promise<ImportPurchaseRequestsCsvResult> {
  if (!isLoginRoute() && (tokenStore.access || tokenStore.refresh)) {
    const fresh = await ensureFreshAccessToken();
    if (!fresh) {
      clearSessionAndRedirectToLogin();
      throw new ApiError(401, "unauthorized", "Session expired");
    }
  }

  const formData = new FormData();
  formData.append("file", params.file);
  formData.append("transaction_date", params.transactionDate);
  formData.append("target_status", params.targetStatus);
  if (params.proofs && Object.keys(params.proofs).length > 0) {
    formData.append("proofs", JSON.stringify(params.proofs));
  }

  const headers = new Headers();
  if (!isLoginRoute()) {
    const token = tokenStore.access;
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(
    `${config.apiBaseUrl}/api/admin/purchase-requests/import`,
    {
      method: "POST",
      headers,
      body: formData,
    },
  );

  if (res.status === 401 && !_retried && !isLoginRoute()) {
    const refreshed = await performSessionRefresh();
    if (refreshed) {
      return importPurchaseRequestsCsvRequest(params, true);
    }
    clearSessionAndRedirectToLogin();
  }

  let json: Envelope<ImportPurchaseRequestsCsvResult>;
  try {
    json = (await res.json()) as Envelope<ImportPurchaseRequestsCsvResult>;
  } catch {
    throw new ApiError(res.status, "invalid_response", res.statusText);
  }

  if (!res.ok || json.success === false) {
    const err = json.error;
    throw new ApiError(
      res.status,
      err?.code ?? "error",
      err?.message ?? "Import failed",
      err?.fields,
      json.data,
    );
  }

  return json.data as ImportPurchaseRequestsCsvResult;
}

/** Import purchase requests from a CSV file. */
export async function importPurchaseRequestsCsv(
  params: ImportPurchaseRequestsCsvParams,
): Promise<ImportPurchaseRequestsCsvResult> {
  return importPurchaseRequestsCsvRequest(params);
}

/** Trigger a browser download for a purchase-requests CSV blob. */
export function downloadPurchaseRequestsCsv(
  blob: Blob,
  options: { filename?: string; date?: Date } = {},
) {
  const { filename, date = new Date() } = options;
  const stamp = date.toISOString().slice(0, 10);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download =
    filename ?? `purchase-requests-export-${stamp}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export interface UpdatePurchaseStatusPayload {
  status: PurchaseRequestStatus;
  proof_url?: string;
}

/** Advance purchase request status (optionally with proof photo URL). */
export const updatePurchaseStatus = purchaseRequestsAdminApi.updateStatus;

/** Update the PAID status-history timestamp used for cash-flow reporting. */
export const updatePaidDate = purchaseRequestsAdminApi.updatePaidDate;

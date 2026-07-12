import { api, type ApiResult } from "./client";
import { parseNumeric } from "./suppliers";
import type {
  ProductionAggregatedIngredient,
  ProductionLineStockEstimation,
  ProductionRequest,
  ProductionRequestEstimateResponse,
  ProductionRequestItem,
  ProductionRequestStatus,
  ProductionRequestStatusHistoryEntry,
  ProductionRequestSummary,
  ProductionStockEstimationIngredient,
} from "./types";
import type { ProductionRequestFormValues } from "@/lib/validations";

/** Wire format from the Go backend (`decimal.Decimal` marshals as JSON string). */
interface ProductionStockEstimationIngredientRaw
  extends Omit<
    ProductionStockEstimationIngredient,
    | "quantity_per_unit"
    | "required_quantity"
    | "current_stock_quantity"
    | "remaining_after"
  > {
  quantity_per_unit: number | string;
  required_quantity: number | string;
  current_stock_quantity: number | string;
  remaining_after: number | string;
}

interface ProductionLineStockEstimationRaw
  extends Omit<ProductionLineStockEstimation, "ingredients"> {
  ingredients?: ProductionStockEstimationIngredientRaw[];
}

interface ProductionAggregatedIngredientRaw
  extends Omit<
    ProductionAggregatedIngredient,
    "required_quantity" | "current_stock_quantity" | "remaining_after"
  > {
  required_quantity: number | string;
  current_stock_quantity: number | string;
  remaining_after: number | string;
}

interface ProductionRequestItemRaw
  extends Omit<ProductionRequestItem, "stock_estimation"> {
  stock_estimation: ProductionLineStockEstimationRaw;
}

interface ProductionRequestRaw
  extends Omit<
    ProductionRequest,
    "items" | "aggregated_ingredients" | "status_history"
  > {
  items: ProductionRequestItemRaw[];
  aggregated_ingredients?: ProductionAggregatedIngredientRaw[];
  status_history?: ProductionRequestStatusHistoryEntry[];
}

interface ProductionRequestEstimateResponseRaw
  extends Omit<ProductionRequestEstimateResponse, "items" | "aggregated_ingredients"> {
  items: Array<
    Omit<ProductionRequestEstimateResponse["items"][number], "stock_estimation"> & {
      stock_estimation: ProductionLineStockEstimationRaw;
    }
  >;
  aggregated_ingredients?: ProductionAggregatedIngredientRaw[];
}

export function normalizeProductionStockEstimationIngredient(
  raw: ProductionStockEstimationIngredientRaw,
): ProductionStockEstimationIngredient {
  return {
    ...raw,
    quantity_per_unit: parseNumeric(raw.quantity_per_unit),
    required_quantity: parseNumeric(raw.required_quantity),
    current_stock_quantity: parseNumeric(raw.current_stock_quantity),
    remaining_after: parseNumeric(raw.remaining_after),
  };
}

export function normalizeProductionLineStockEstimation(
  raw: ProductionLineStockEstimationRaw,
): ProductionLineStockEstimation {
  return {
    ...raw,
    ingredients: (raw.ingredients ?? []).map(
      normalizeProductionStockEstimationIngredient,
    ),
  };
}

export function normalizeProductionAggregatedIngredient(
  raw: ProductionAggregatedIngredientRaw,
): ProductionAggregatedIngredient {
  return {
    ...raw,
    required_quantity: parseNumeric(raw.required_quantity),
    current_stock_quantity: parseNumeric(raw.current_stock_quantity),
    remaining_after: parseNumeric(raw.remaining_after),
  };
}

export function normalizeProductionRequestItem(
  raw: ProductionRequestItemRaw,
): ProductionRequestItem {
  return {
    ...raw,
    stock_estimation: normalizeProductionLineStockEstimation(raw.stock_estimation),
  };
}

export function normalizeProductionRequest(
  raw: ProductionRequestRaw,
): ProductionRequest {
  return {
    ...raw,
    items: (raw.items ?? []).map(normalizeProductionRequestItem),
    aggregated_ingredients: (raw.aggregated_ingredients ?? []).map(
      normalizeProductionAggregatedIngredient,
    ),
    status_history: raw.status_history ?? [],
  };
}

function normalizeProductionRequestSummary(
  raw: ProductionRequestSummary,
): ProductionRequestSummary {
  return { ...raw };
}

function normalizeEstimateResponse(
  raw: ProductionRequestEstimateResponseRaw,
): ProductionRequestEstimateResponse {
  return {
    ...raw,
    items: raw.items.map((item) => ({
      ...item,
      stock_estimation: normalizeProductionLineStockEstimation(
        item.stock_estimation,
      ),
    })),
    aggregated_ingredients: (raw.aggregated_ingredients ?? []).map(
      normalizeProductionAggregatedIngredient,
    ),
  };
}

function normalizeListResult(
  result: ApiResult<ProductionRequestSummary[]>,
): ApiResult<ProductionRequestSummary[]> {
  return {
    ...result,
    data: result.data.map(normalizeProductionRequestSummary),
  };
}

function normalizeItemResult(
  result: ApiResult<ProductionRequestRaw>,
): ApiResult<ProductionRequest> {
  return {
    ...result,
    data: normalizeProductionRequest(result.data),
  };
}

function normalizeEstimateResult(
  result: ApiResult<ProductionRequestEstimateResponseRaw>,
): ApiResult<ProductionRequestEstimateResponse> {
  return {
    ...result,
    data: normalizeEstimateResponse(result.data),
  };
}

export interface ListProductionRequestsParams {
  page?: number;
  perPage?: number;
  status?: ProductionRequestStatus | "";
}

export interface ProductionRequestItemPayload {
  menu_id: string;
  quantity: number;
}

export interface EstimateProductionRequestPayload {
  items: ProductionRequestItemPayload[];
}

export interface CreateProductionRequestPayload {
  items: ProductionRequestItemPayload[];
  notes?: string;
}

export type UpdateProductionRequestPayload = CreateProductionRequestPayload;

/** Map form values to an API payload with integer quantities. */
export function productionRequestFormToPayload(
  values: ProductionRequestFormValues,
): CreateProductionRequestPayload {
  const payload: CreateProductionRequestPayload = {
    items: values.items.map((item) => ({
      menu_id: item.menu_id,
      quantity: item.quantity,
    })),
  };

  const notes = values.notes?.trim();
  if (notes) {
    payload.notes = notes;
  }

  return payload;
}

export const productionRequestsAdminApi = {
  estimate: async (payload: EstimateProductionRequestPayload) => {
    const result = await api.post<ProductionRequestEstimateResponseRaw>(
      "/api/admin/production-requests/estimate",
      payload,
    );
    return normalizeEstimateResult(result);
  },

  create: async (payload: CreateProductionRequestPayload) => {
    const result = await api.post<ProductionRequestRaw>(
      "/api/admin/production-requests",
      payload,
    );
    return normalizeItemResult(result);
  },

  list: async ({
    page = 1,
    perPage = 10,
    status = "",
  }: ListProductionRequestsParams = {}) => {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    if (status) params.set("status", status);
    const result = await api.get<ProductionRequestSummary[]>(
      `/api/admin/production-requests?${params.toString()}`,
    );
    return normalizeListResult(result);
  },

  get: async (id: string) => {
    const result = await api.get<ProductionRequestRaw>(
      `/api/admin/production-requests/${id}`,
    );
    return normalizeItemResult(result);
  },

  update: async (id: string, payload: UpdateProductionRequestPayload) => {
    const result = await api.put<ProductionRequestRaw>(
      `/api/admin/production-requests/${id}`,
      payload,
    );
    return normalizeItemResult(result);
  },

  updateStatus: async (id: string, status: ProductionRequestStatus) => {
    const result = await api.patch<ProductionRequestRaw>(
      `/api/admin/production-requests/${id}/status`,
      { status },
    );
    return normalizeItemResult(result);
  },

  markItemFinished: async (
    id: string,
    itemId: string,
    isFinished: boolean,
  ) => {
    const result = await api.patch<ProductionRequestRaw>(
      `/api/admin/production-requests/${id}/items/${itemId}`,
      { is_finished: isFinished },
    );
    return normalizeItemResult(result);
  },
};

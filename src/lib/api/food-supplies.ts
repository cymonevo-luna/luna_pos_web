import { api, type ApiResult } from "./client";
import type { FoodSupply, FoodSupplyUnit } from "./types";
import type { FoodSupplyFormValues } from "@/lib/validations";

/** Wire format from the Go backend (`decimal.Decimal` marshals as JSON string). */
interface FoodSupplyRaw extends Omit<FoodSupply, "stock_quantity"> {
  stock_quantity: number | string;
}

/**
 * Coerce API `stock_quantity` (number or numeric string) to a finite number.
 * Null/undefined and non-numeric values fall back to `0` so UI formatters never crash.
 */
export function parseStockQuantity(value: unknown): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function normalizeFoodSupply(raw: FoodSupplyRaw): FoodSupply {
  return {
    ...raw,
    stock_quantity: parseStockQuantity(raw.stock_quantity),
  };
}

function normalizeListResult(
  result: ApiResult<FoodSupplyRaw[]>,
): ApiResult<FoodSupply[]> {
  return {
    ...result,
    data: result.data.map(normalizeFoodSupply),
  };
}

function normalizeItemResult(
  result: ApiResult<FoodSupplyRaw>,
): ApiResult<FoodSupply> {
  return {
    ...result,
    data: normalizeFoodSupply(result.data),
  };
}

export interface ListFoodSuppliesParams {
  page?: number;
  perPage?: number;
  search?: string;
}

export interface CreateFoodSupplyPayload {
  title: string;
  description?: string | null;
  stock_quantity: number;
  unit: FoodSupplyUnit;
}

export type UpdateFoodSupplyPayload = CreateFoodSupplyPayload;

/** Map form values to an API payload, omitting blank descriptions. */
export function foodSupplyFormToPayload(
  values: FoodSupplyFormValues,
): CreateFoodSupplyPayload {
  const payload: CreateFoodSupplyPayload = {
    title: values.title,
    stock_quantity: values.stock_quantity,
    unit: values.unit,
  };

  const description = values.description?.trim();
  if (description) {
    payload.description = description;
  }

  return payload;
}

export const foodSuppliesAdminApi = {
  list: async ({
    page = 1,
    perPage = 10,
    search = "",
  }: ListFoodSuppliesParams = {}) => {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    if (search) params.set("search", search);
    const result = await api.get<FoodSupplyRaw[]>(
      `/api/admin/food-supplies?${params.toString()}`,
    );
    return normalizeListResult(result);
  },

  get: async (id: string) => {
    const result = await api.get<FoodSupplyRaw>(
      `/api/admin/food-supplies/${id}`,
    );
    return normalizeItemResult(result);
  },

  create: async (payload: CreateFoodSupplyPayload) => {
    const result = await api.post<FoodSupplyRaw>(
      "/api/admin/food-supplies",
      payload,
    );
    return normalizeItemResult(result);
  },

  update: async (id: string, payload: UpdateFoodSupplyPayload) => {
    const result = await api.put<FoodSupplyRaw>(
      `/api/admin/food-supplies/${id}`,
      payload,
    );
    return normalizeItemResult(result);
  },

  delete: (id: string) => api.delete<void>(`/api/admin/food-supplies/${id}`),
};

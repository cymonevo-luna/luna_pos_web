import { api, type ApiResult } from "./client";
import type {
  CookingMeasurement,
  FoodSupply,
  FoodSupplyManualEditHistoryEntry,
  FoodSupplyUnit,
} from "./types";
import type { FoodSupplyFormValues } from "@/lib/validations";

/** Wire format from the Go backend (`decimal.Decimal` marshals as JSON string). */
interface CookingMeasurementRaw
  extends Omit<CookingMeasurement, "conversion_quantity"> {
  conversion_quantity: number | string;
}

interface FoodSupplyRaw
  extends Omit<
    FoodSupply,
    "stock_quantity" | "manual_edit_history" | "cooking_measurements"
  > {
  stock_quantity: number | string;
  manual_edit_history?: FoodSupplyManualEditHistoryEntry[];
  cooking_measurements?: CookingMeasurementRaw[];
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

/** Coerce API conversion_quantity to a decimal string for form/API payloads. */
export function formatConversionQuantity(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const n = Number(trimmed);
    return Number.isFinite(n) ? trimmed : "";
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
}

export function normalizeCookingMeasurement(
  raw: CookingMeasurementRaw,
): CookingMeasurement {
  return {
    ...raw,
    conversion_quantity: formatConversionQuantity(raw.conversion_quantity),
  };
}

export function normalizeFoodSupply(raw: FoodSupplyRaw): FoodSupply {
  return {
    ...raw,
    stock_quantity: parseStockQuantity(raw.stock_quantity),
    manual_edit_history: raw.manual_edit_history ?? [],
    cooking_measurements: (raw.cooking_measurements ?? []).map(
      normalizeCookingMeasurement,
    ),
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

export interface CookingMeasurementPayload {
  id?: string;
  name: string;
  conversion_quantity: string;
}

export interface CreateFoodSupplyPayload {
  title: string;
  description?: string | null;
  stock_quantity: number;
  unit: FoodSupplyUnit;
  cooking_measurements?: CookingMeasurementPayload[];
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

  const measurements = values.cooking_measurements
    .map((measurement) => {
      const name = measurement.name.trim();
      const conversion = measurement.conversion_quantity.trim();
      if (!name && !conversion) return null;
      const item: CookingMeasurementPayload = {
        name,
        conversion_quantity: conversion,
      };
      if (measurement.id) {
        item.id = measurement.id;
      }
      return item;
    })
    .filter((measurement): measurement is CookingMeasurementPayload =>
      measurement !== null,
    );

  if (measurements.length > 0) {
    payload.cooking_measurements = measurements;
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

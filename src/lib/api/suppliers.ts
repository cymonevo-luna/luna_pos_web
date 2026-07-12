import { api, type ApiResult } from "./client";
import type { Supplier, SupplierFoodItem } from "./types";
import type { SupplierFormValues } from "@/lib/validations";

/** Wire format from the Go backend (`decimal.Decimal` marshals as JSON string). */
interface SupplierFoodItemRaw extends Omit<SupplierFoodItem, "quantity"> {
  quantity: number | string;
}

interface SupplierRaw extends Omit<Supplier, "food_items" | "delivery_cost"> {
  food_items: SupplierFoodItemRaw[];
  delivery_cost: number | string | null;
}

/**
 * Coerce API `quantity` (number or numeric string) to a finite number.
 * Null/undefined and non-numeric values fall back to `0` so UI formatters never crash.
 */
export function parseQuantity(value: unknown): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseDeliveryCost(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeFoodItem(raw: SupplierFoodItemRaw): SupplierFoodItem {
  return {
    ...raw,
    quantity: parseQuantity(raw.quantity),
  };
}

export function normalizeSupplier(raw: SupplierRaw): Supplier {
  return {
    ...raw,
    delivery_cost: parseDeliveryCost(raw.delivery_cost),
    food_items: raw.food_items.map(normalizeFoodItem),
  };
}

function normalizeListResult(
  result: ApiResult<SupplierRaw[]>,
): ApiResult<Supplier[]> {
  return {
    ...result,
    data: result.data.map(normalizeSupplier),
  };
}

function normalizeItemResult(
  result: ApiResult<SupplierRaw>,
): ApiResult<Supplier> {
  return {
    ...result,
    data: normalizeSupplier(result.data),
  };
}

export interface ListSuppliersParams {
  page?: number;
  perPage?: number;
  search?: string;
}

export interface SupplierFoodItemPayload {
  food_supply_id: string;
  price: number;
  quantity: number;
  unit: SupplierFoodItem["unit"];
}

export interface CreateSupplierPayload {
  name: string;
  phone_number: string;
  address: string;
  supports_delivery: boolean;
  delivery_cost: number;
  food_items: SupplierFoodItemPayload[];
}

export type UpdateSupplierPayload = CreateSupplierPayload;

/** Map form values to an API payload. */
export function supplierFormToPayload(
  values: SupplierFormValues,
): CreateSupplierPayload {
  return {
    name: values.name,
    phone_number: values.phone_number.trim(),
    address: values.address,
    supports_delivery: values.supports_delivery,
    delivery_cost: values.supports_delivery ? (values.delivery_cost ?? 0) : 0,
    food_items: values.food_items.map((item) => ({
      food_supply_id: item.food_supply_id,
      price: item.price,
      quantity: item.quantity,
      unit: item.unit,
    })),
  };
}

export const suppliersAdminApi = {
  list: async ({
    page = 1,
    perPage = 10,
    search = "",
  }: ListSuppliersParams = {}) => {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    if (search) params.set("search", search);
    const result = await api.get<SupplierRaw[]>(
      `/api/admin/suppliers?${params.toString()}`,
    );
    return normalizeListResult(result);
  },

  get: async (id: string) => {
    const result = await api.get<SupplierRaw>(`/api/admin/suppliers/${id}`);
    return normalizeItemResult(result);
  },

  create: async (payload: CreateSupplierPayload) => {
    const result = await api.post<SupplierRaw>(
      "/api/admin/suppliers",
      payload,
    );
    return normalizeItemResult(result);
  },

  update: async (id: string, payload: UpdateSupplierPayload) => {
    const result = await api.put<SupplierRaw>(
      `/api/admin/suppliers/${id}`,
      payload,
    );
    return normalizeItemResult(result);
  },

  delete: (id: string) => api.delete<void>(`/api/admin/suppliers/${id}`),
};

import { api, type ApiResult } from "./client";
import type { Supplier, SupplierPrice } from "./types";
import type {
  SupplierFormValues,
  SupplierPriceFormValues,
} from "@/lib/validations";

/** Wire format from the Go backend (`decimal.Decimal` marshals as JSON string). */
interface SupplierPriceRaw
  extends Omit<SupplierPrice, "price_amount" | "price_quantity" | "unit_price"> {
  price_amount: number | string;
  price_quantity: number | string;
  unit_price?: number | string;
}

interface SupplierRaw
  extends Omit<Supplier, "price_quotes" | "delivery_cost" | "price_quotes_count"> {
  price_quotes?: SupplierPriceRaw[];
  delivery_cost: number | string | null;
  price_quotes_count?: number;
}

/**
 * Coerce API numeric values (number or numeric string) to a finite number.
 * Null/undefined and non-numeric values fall back to `0`.
 */
export function parseNumeric(value: unknown): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseDeliveryCost(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizePrice(raw: SupplierPriceRaw): SupplierPrice {
  return {
    ...raw,
    price_amount: parseNumeric(raw.price_amount),
    price_quantity: parseNumeric(raw.price_quantity),
    unit_price:
      raw.unit_price == null ? undefined : parseNumeric(raw.unit_price),
  };
}

export function normalizeSupplier(raw: SupplierRaw): Supplier {
  const priceQuotes = (raw.price_quotes ?? []).map(normalizePrice);
  return {
    ...raw,
    delivery_cost: parseDeliveryCost(raw.delivery_cost),
    price_quotes: priceQuotes,
    price_quotes_count:
      raw.price_quotes_count ?? priceQuotes.length,
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

function normalizePriceResult(
  result: ApiResult<SupplierPriceRaw>,
): ApiResult<SupplierPrice> {
  return {
    ...result,
    data: normalizePrice(result.data),
  };
}

export interface ListSuppliersParams {
  page?: number;
  perPage?: number;
  search?: string;
}

export interface CreateSupplierPayload {
  name: string;
  phone_number: string;
  address: string;
  supports_delivery: boolean;
  delivery_cost: number;
}

export type UpdateSupplierPayload = CreateSupplierPayload;

export interface CreateSupplierPricePayload {
  food_supply_id: string;
  price_amount: number;
  price_quantity: number;
}

export type UpdateSupplierPricePayload = CreateSupplierPricePayload;

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
  };
}

/** Map price form values to an API payload. */
export function supplierPriceFormToPayload(
  values: SupplierPriceFormValues,
): CreateSupplierPricePayload {
  return {
    food_supply_id: values.food_supply_id,
    price_amount: values.price_amount,
    price_quantity: values.price_quantity,
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

  createPrice: async (supplierId: string, payload: CreateSupplierPricePayload) => {
    const result = await api.post<SupplierPriceRaw>(
      `/api/admin/suppliers/${supplierId}/prices`,
      payload,
    );
    return normalizePriceResult(result);
  },

  updatePrice: async (priceId: string, payload: UpdateSupplierPricePayload) => {
    const result = await api.put<SupplierPriceRaw>(
      `/api/admin/supplier-prices/${priceId}`,
      payload,
    );
    return normalizePriceResult(result);
  },

  deletePrice: (priceId: string) =>
    api.delete<void>(`/api/admin/supplier-prices/${priceId}`),
};

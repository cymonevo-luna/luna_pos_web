import { api } from "./client";
import type { FoodSupply, FoodSupplyUnit } from "./types";
import type { FoodSupplyFormValues } from "@/lib/validations";

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
  list: ({ page = 1, perPage = 10, search = "" }: ListFoodSuppliesParams = {}) => {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    if (search) params.set("search", search);
    return api.get<FoodSupply[]>(
      `/api/admin/food-supplies?${params.toString()}`,
    );
  },

  get: (id: string) => api.get<FoodSupply>(`/api/admin/food-supplies/${id}`),

  create: (payload: CreateFoodSupplyPayload) =>
    api.post<FoodSupply>("/api/admin/food-supplies", payload),

  update: (id: string, payload: UpdateFoodSupplyPayload) =>
    api.put<FoodSupply>(`/api/admin/food-supplies/${id}`, payload),

  delete: (id: string) => api.delete<void>(`/api/admin/food-supplies/${id}`),
};

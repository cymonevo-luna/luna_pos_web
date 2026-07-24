import { api } from "./client";
import type { OrderOption } from "./types";
import type { OrderOptionFormValues } from "@/lib/validations";

export interface ListOrderOptionsParams {
  page?: number;
  perPage?: number;
  search?: string;
}

export interface CreateOrderOptionPayload {
  name: string;
  additional_price: number;
}

export type UpdateOrderOptionPayload = CreateOrderOptionPayload;

/** Map form values to an API payload with trimmed name. */
export function orderOptionFormToPayload(
  values: OrderOptionFormValues,
): CreateOrderOptionPayload {
  return {
    name: values.name.trim(),
    additional_price: values.additional_price ?? 0,
  };
}

export const orderOptionsAdminApi = {
  list: ({
    page = 1,
    perPage = 10,
    search = "",
  }: ListOrderOptionsParams = {}) => {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    if (search) params.set("search", search);
    return api.get<OrderOption[]>(
      `/api/admin/order-options?${params.toString()}`,
    );
  },

  get: (id: string) =>
    api.get<OrderOption>(`/api/admin/order-options/${id}`),

  create: (payload: CreateOrderOptionPayload) =>
    api.post<OrderOption>("/api/admin/order-options", payload),

  update: (id: string, payload: UpdateOrderOptionPayload) =>
    api.put<OrderOption>(`/api/admin/order-options/${id}`, payload),

  delete: (id: string) =>
    api.delete<void>(`/api/admin/order-options/${id}`),

  reorder: (orderOptionIds: string[]) =>
    api.put<OrderOption[]>("/api/admin/order-options/reorder", {
      order_option_ids: orderOptionIds,
    }),
};

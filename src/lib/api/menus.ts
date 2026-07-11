import { api } from "./client";
import type { Menu } from "./types";
import type { MenuFormValues } from "@/lib/validations";

export interface ListMenusParams {
  page?: number;
  perPage?: number;
  search?: string;
  categoryId?: string;
}

export interface CreateMenuPayload {
  title: string;
  description?: string | null;
  category_id: string;
  photo_url?: string | null;
  available_stock: number;
  sell_price: number;
}

export type UpdateMenuPayload = CreateMenuPayload;

/** Map form values to an API payload, omitting blank optional fields. */
export function menuFormToPayload(values: MenuFormValues): CreateMenuPayload {
  const payload: CreateMenuPayload = {
    title: values.title.trim(),
    category_id: values.category_id,
    available_stock: values.available_stock,
    sell_price: values.sell_price,
  };

  const description = values.description?.trim();
  if (description) {
    payload.description = description;
  }

  const photoUrl = values.photo_url?.trim();
  if (photoUrl) {
    payload.photo_url = photoUrl;
  }

  return payload;
}

export const menusAdminApi = {
  list: ({
    page = 1,
    perPage = 10,
    search = "",
    categoryId = "",
  }: ListMenusParams = {}) => {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    if (search) params.set("search", search);
    if (categoryId) params.set("category_id", categoryId);
    return api.get<Menu[]>(`/api/admin/menus?${params.toString()}`);
  },

  get: (id: string) => api.get<Menu>(`/api/admin/menus/${id}`),

  create: (payload: CreateMenuPayload) =>
    api.post<Menu>("/api/admin/menus", payload),

  update: (id: string, payload: UpdateMenuPayload) =>
    api.put<Menu>(`/api/admin/menus/${id}`, payload),

  delete: (id: string) => api.delete<void>(`/api/admin/menus/${id}`),
};

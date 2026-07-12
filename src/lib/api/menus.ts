import { api } from "./client";
import type { Menu } from "./types";
import type {
  MenuBasicFormValues,
  MenuCogsFormValues,
  MenuFormValues,
} from "@/lib/validations";

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
  recipe_yield: number;
  margin_percent: number;
  vat_percent: number;
}

export type UpdateMenuPayload = CreateMenuPayload;

export type MenuBasicPayload = Pick<
  CreateMenuPayload,
  "title" | "category_id" | "available_stock" | "sell_price"
> & {
  description?: string | null;
  photo_url?: string | null;
};

export type MenuCogsPayload = Pick<
  CreateMenuPayload,
  "recipe_yield" | "margin_percent" | "vat_percent"
>;

/** Map basic menu form values to an API payload, omitting blank optional fields. */
export function menuBasicFormToPayload(
  values: MenuBasicFormValues,
): MenuBasicPayload {
  const payload: MenuBasicPayload = {
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

/** Map COGS form values to an API payload. */
export function menuCogsFormToPayload(
  values: MenuCogsFormValues,
): MenuCogsPayload {
  return {
    recipe_yield: values.recipe_yield,
    margin_percent: values.margin_percent,
    vat_percent: values.vat_percent,
  };
}

/** Merge basic and COGS payloads for full menu create/update requests. */
export function menuFullFormToPayload(
  basic: MenuBasicFormValues,
  cogs: MenuCogsFormValues,
): CreateMenuPayload {
  return {
    ...menuBasicFormToPayload(basic),
    ...menuCogsFormToPayload(cogs),
  };
}

/** Map combined form values to an API payload, omitting blank optional fields. */
export function menuFormToPayload(values: MenuFormValues): CreateMenuPayload {
  return menuFullFormToPayload(values, values);
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

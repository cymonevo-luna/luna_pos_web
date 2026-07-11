import { api } from "./client";
import type { Category } from "./types";
import type { CategoryFormValues } from "@/lib/validations";

export interface ListCategoriesParams {
  page?: number;
  perPage?: number;
  search?: string;
}

export interface CreateCategoryPayload {
  name: string;
}

export type UpdateCategoryPayload = CreateCategoryPayload;

/** Map form values to an API payload with trimmed name. */
export function categoryFormToPayload(
  values: CategoryFormValues,
): CreateCategoryPayload {
  return {
    name: values.name.trim(),
  };
}

export const categoriesAdminApi = {
  list: ({ page = 1, perPage = 10, search = "" }: ListCategoriesParams = {}) => {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    if (search) params.set("search", search);
    return api.get<Category[]>(`/api/admin/categories?${params.toString()}`);
  },

  get: (id: string) => api.get<Category>(`/api/admin/categories/${id}`),

  create: (payload: CreateCategoryPayload) =>
    api.post<Category>("/api/admin/categories", payload),

  update: (id: string, payload: UpdateCategoryPayload) =>
    api.put<Category>(`/api/admin/categories/${id}`, payload),

  delete: (id: string) => api.delete<void>(`/api/admin/categories/${id}`),

  reorder: (categoryIds: string[]) =>
    api.put<Category[]>("/api/admin/categories/reorder", {
      category_ids: categoryIds,
    }),
};

import { api, type ApiResult } from "./client";
import type { Menu } from "./types";
import type {
  MenuBasicFormValues,
  MenuCogsFormValues,
  MenuFormValues,
} from "@/lib/validations";

export type MenuSortBy = "title" | "stock";
export type MenuSortOrder = "asc" | "desc";

export interface ListMenusParams {
  page?: number;
  perPage?: number;
  search?: string;
  categoryId?: string;
  sortBy?: MenuSortBy;
  sortOrder?: MenuSortOrder;
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

interface MenuRaw extends Omit<Menu, "has_ingredients"> {
  has_ingredients?: boolean;
}

export function normalizeMenu(raw: MenuRaw): Menu {
  return {
    ...raw,
    has_ingredients: raw.has_ingredients ?? false,
  };
}

function normalizeListResult(result: ApiResult<MenuRaw[]>): ApiResult<Menu[]> {
  return {
    ...result,
    data: result.data.map(normalizeMenu),
  };
}

function normalizeItemResult(result: ApiResult<MenuRaw>): ApiResult<Menu> {
  return {
    ...result,
    data: normalizeMenu(result.data),
  };
}

const DEFAULT_MENU_PHOTO_FILENAME = "default-food.png";

/** True when `value` is a non-empty absolute http(s) URL suitable for the API. */
export function isAbsolutePhotoUrl(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
  );
}

/** True when a menu photo form value is empty, an absolute URL, or an allowed `/static/` path. */
export function isAllowedMenuPhotoUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return isAbsolutePhotoUrl(trimmed);
  }
  return trimmed.startsWith("/static/");
}

/**
 * Map API `photo_url` values to form display values.
 * System default images normalize to empty; uploaded `/static/` paths are kept.
 */
export function normalizeMenuPhotoFormValue(photoUrl?: string | null): string {
  const trimmed = photoUrl?.trim() ?? "";
  if (!trimmed) return "";

  if (trimmed.startsWith("/static/")) {
    const filename = trimmed.split("/").pop() ?? "";
    if (filename === DEFAULT_MENU_PHOTO_FILENAME) {
      return "";
    }
    return trimmed;
  }

  return trimmed;
}

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
  if (photoUrl && isAbsolutePhotoUrl(photoUrl)) {
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
  list: async ({
    page = 1,
    perPage = 10,
    search = "",
    categoryId = "",
    sortBy,
    sortOrder,
  }: ListMenusParams = {}) => {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    if (search) params.set("search", search);
    if (categoryId) params.set("category_id", categoryId);
    if (sortBy) params.set("sort_by", sortBy);
    if (sortOrder) params.set("sort_order", sortOrder);
    const result = await api.get<MenuRaw[]>(
      `/api/admin/menus?${params.toString()}`,
    );
    return normalizeListResult(result);
  },

  get: async (id: string) => {
    const result = await api.get<MenuRaw>(`/api/admin/menus/${id}`);
    return normalizeItemResult(result);
  },

  create: async (payload: CreateMenuPayload) => {
    const result = await api.post<MenuRaw>("/api/admin/menus", payload);
    return normalizeItemResult(result);
  },

  update: async (id: string, payload: UpdateMenuPayload) => {
    const result = await api.put<MenuRaw>(`/api/admin/menus/${id}`, payload);
    return normalizeItemResult(result);
  },

  delete: (id: string) => api.delete<void>(`/api/admin/menus/${id}`),

  exportCsv: () => api.downloadBlobResult("/api/admin/menus/export"),
};

/** Trigger a browser download for a menus CSV blob. */
export function downloadMenusCsv(
  blob: Blob,
  options: { filename?: string; date?: Date } = {},
) {
  const { filename, date = new Date() } = options;
  const stamp = date.toISOString().slice(0, 10);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename ?? `menus-export-${stamp}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

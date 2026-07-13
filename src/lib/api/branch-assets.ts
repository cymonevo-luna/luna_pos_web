import { api, type ApiResult } from "./client";
import { parseNumeric } from "./suppliers";
import type {
  BranchAsset,
  BranchAssetsProfitSource,
  BranchAssetsSummary,
} from "./types";
import { formatDate, formatRupiah } from "@/lib/utils";
import type { BranchAssetFormValues } from "@/lib/validations";

/** Wire format from the Go backend (`decimal.Decimal` marshals as JSON string). */
interface BranchAssetRaw
  extends Omit<BranchAsset, "quantity" | "price_amount" | "line_value"> {
  quantity: number | string;
  price_amount: number | string;
  line_value: number | string;
}

export function normalizeBranchAsset(raw: BranchAssetRaw): BranchAsset {
  return {
    ...raw,
    quantity: parseNumeric(raw.quantity),
    price_amount: parseNumeric(raw.price_amount),
    line_value: parseNumeric(raw.line_value),
  };
}

function normalizeListResult(
  result: ApiResult<BranchAssetRaw[]>,
): ApiResult<BranchAsset[]> {
  return {
    ...result,
    data: result.data.map(normalizeBranchAsset),
  };
}

function normalizeItemResult(
  result: ApiResult<BranchAssetRaw>,
): ApiResult<BranchAsset> {
  return {
    ...result,
    data: normalizeBranchAsset(result.data),
  };
}

export interface ListBranchAssetsParams {
  page?: number;
  perPage?: number;
  search?: string;
}

export interface CreateBranchAssetPayload {
  title: string;
  description?: string | null;
  photo_url?: string;
  quantity: string;
  price_amount: number;
}

export type UpdateBranchAssetPayload = CreateBranchAssetPayload;

export interface BranchAssetsSummaryParams {
  profitLookbackDays?: number;
}

/** Map form values to an API payload. */
export function branchAssetFormToPayload(
  values: BranchAssetFormValues,
): CreateBranchAssetPayload {
  const payload: CreateBranchAssetPayload = {
    title: values.title.trim(),
    quantity: String(values.quantity),
    price_amount: values.price_amount,
    photo_url: values.photo_url?.trim() ?? "",
  };

  const description = values.description?.trim();
  if (description) {
    payload.description = description;
  }

  return payload;
}

export async function listBranchAssets({
  page = 1,
  perPage = 10,
  search = "",
}: ListBranchAssetsParams = {}) {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  if (search) params.set("search", search);
  const result = await api.get<BranchAssetRaw[]>(
    `/api/admin/branch-assets?${params.toString()}`,
  );
  return normalizeListResult(result);
}

export async function getBranchAsset(id: string) {
  const result = await api.get<BranchAssetRaw>(
    `/api/admin/branch-assets/${id}`,
  );
  return normalizeItemResult(result);
}

export async function createBranchAsset(payload: CreateBranchAssetPayload) {
  const result = await api.post<BranchAssetRaw>(
    "/api/admin/branch-assets",
    payload,
  );
  return normalizeItemResult(result);
}

export async function updateBranchAsset(
  id: string,
  payload: UpdateBranchAssetPayload,
) {
  const result = await api.put<BranchAssetRaw>(
    `/api/admin/branch-assets/${id}`,
    payload,
  );
  return normalizeItemResult(result);
}

export async function deleteBranchAsset(id: string) {
  return api.delete<void>(`/api/admin/branch-assets/${id}`);
}

export function formatProfitSourceSubtitle(
  source: BranchAssetsProfitSource,
): string {
  const dateFrom = formatDate(source.date_from);
  const dateTo = formatDate(source.date_to);
  const dateRange = `${dateFrom} – ${dateTo}`;

  if (source.net_amount_total > 0) {
    return `Based on ${formatRupiah(source.net_amount_total)} net profit over the last ${source.lookback_days} days (${dateRange})`;
  }

  return `No sales in the last ${source.lookback_days} days (${dateRange})`;
}

export function getBranchAssetsSummary({
  profitLookbackDays,
}: BranchAssetsSummaryParams = {}) {
  const params = new URLSearchParams();
  if (profitLookbackDays != null) {
    params.set("profit_lookback_days", String(profitLookbackDays));
  }
  const query = params.toString();
  const path = query
    ? `/api/admin/branch-assets/summary?${query}`
    : "/api/admin/branch-assets/summary";
  return api.get<BranchAssetsSummary>(path);
}

export const branchAssetsAdminApi = {
  list: listBranchAssets,
  get: getBranchAsset,
  create: createBranchAsset,
  update: updateBranchAsset,
  delete: deleteBranchAsset,
  summary: getBranchAssetsSummary,
};

import { api } from "./client";
import type { BranchAssetsSummary } from "./types";

export interface BranchAssetsSummaryParams {
  profitLookbackDays?: number;
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
  summary: getBranchAssetsSummary,
};

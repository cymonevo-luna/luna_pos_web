import { api } from "./client";
import type { Feature, MerchantRole, RoleFeatureMapping } from "./types";

export interface UpdateRoleFeaturesPayload {
  features: string[];
}

export function listFeatures() {
  return api.get<Feature[]>("/api/admin/features");
}

export function getRoleFeatures() {
  return api.get<RoleFeatureMapping[]>("/api/admin/role-features");
}

export function updateRoleFeatures(
  role: MerchantRole,
  features: string[],
) {
  const payload: UpdateRoleFeaturesPayload = { features };
  return api.put<RoleFeatureMapping>(
    `/api/admin/role-features/${role}`,
    payload,
  );
}

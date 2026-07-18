import type { MerchantRole } from "@/lib/api/types";
import { DEFAULT_ROLE_FEATURES } from "@/lib/auth/features";

/** Build the default feature grant set for one or more roles (test fixtures). */
export function featuresForRoles(roles: MerchantRole[]): string[] {
  const features = new Set<string>();
  for (const role of roles) {
    for (const feature of DEFAULT_ROLE_FEATURES[role] ?? []) {
      features.add(feature);
    }
  }
  return [...features];
}

export function sourceWithFeatures(roles: MerchantRole[], features?: string[]) {
  return {
    roles,
    features: features ?? featuresForRoles(roles),
  };
}

import { api } from "./client";
import type { StoreSettings } from "./types";
import type { StoreSettingsFormValues } from "@/lib/validations";

export type UpdateStoreSettingsPayload = StoreSettings;

/** Map form values to an API payload with trimmed strings. */
export function storeSettingsFormToPayload(
  values: StoreSettingsFormValues,
): UpdateStoreSettingsPayload {
  return {
    brand_name: values.brand_name.trim(),
    branch_name: values.branch_name.trim(),
    address: values.address.trim(),
    phone: values.phone.trim(),
    thank_you_note: values.thank_you_note?.trim() ?? "",
  };
}

export function getAdminStoreSettings() {
  return api.get<StoreSettings>("/api/admin/store-settings");
}

export function updateAdminStoreSettings(payload: UpdateStoreSettingsPayload) {
  return api.put<StoreSettings>("/api/admin/store-settings", payload);
}

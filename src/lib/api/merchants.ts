import { api } from "./client";
import type { MerchantRegisterResult } from "./types";

export interface MerchantRegisterPayload {
  merchant_name: string;
  address: string;
  phone: string;
  admin_email: string;
  admin_name: string;
  admin_password: string;
}

export const merchantsApi = {
  register: (payload: MerchantRegisterPayload) =>
    api.post<MerchantRegisterResult>("/api/v1/merchants/register", payload, {
      auth: false,
    }),
};

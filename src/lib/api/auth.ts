import { api } from "./client";
import type { LoginResult, MerchantChoice, User } from "./types";

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  merchant_id?: string;
}

export const MERCHANT_REQUIRED_CODE = "merchant_required";

export function isMerchantRequiredError(
  error: unknown,
): error is { code: string; data?: { merchants?: MerchantChoice[] } } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === MERCHANT_REQUIRED_CODE
  );
}

export const authApi = {
  register: (payload: RegisterPayload) =>
    api.post<User>("/api/v1/auth/register", payload, { auth: false }),

  login: (payload: LoginPayload) =>
    api.post<LoginResult>("/api/v1/auth/login", payload, { auth: false }),
};

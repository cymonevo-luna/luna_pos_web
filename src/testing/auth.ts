import { authApi } from "@/lib/api/auth";
import type { LoginResult } from "@/lib/api/types";
import { tokenStore } from "@/lib/auth/tokens";
import { TEST_ACCOUNTS, type TestAccountRole } from "@/testing/accounts";

/** Login page path for the given test role. */
export function getTestLoginPath(role: TestAccountRole): string {
  return role === "cashier" ? "/login" : "/admin/login";
}

export interface LoginAsTestAccountOptions {
  /** Persist tokens in browser cookies via tokenStore. Defaults to true in browser. */
  persistSession?: boolean;
}

/**
 * Authenticate with a dedicated seeded test account via POST /api/v1/auth/login.
 * Never calls /api/v1/auth/register.
 */
export async function loginAsTestAccount(
  role: TestAccountRole,
  options: LoginAsTestAccountOptions = {},
): Promise<LoginResult> {
  const account = TEST_ACCOUNTS[role];
  const { data } = await authApi.login({
    email: account.email,
    password: account.password,
  });

  const persistSession =
    options.persistSession ?? typeof document !== "undefined";
  if (persistSession) {
    tokenStore.set(data.tokens.access_token, data.tokens.refresh_token);
  }

  return data;
}

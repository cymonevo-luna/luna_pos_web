import { config } from "@/lib/config";
import { redirectToLogin } from "@/lib/auth/redirect";
import { refreshTokenPair } from "@/lib/auth/refresh";
import { clearAuthSession } from "@/lib/auth/session-store";
import { tokenStore } from "@/lib/auth/tokens";
import type { Envelope, PageMeta } from "./types";

/** Thrown for any non-successful API response. Carries the parsed error body. */
export class ApiError extends Error {
  code: string;
  status: number;
  fields?: Record<string, string>;
  data?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    fields?: Record<string, string>,
    data?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.data = data;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Attach the bearer access token. Defaults to true. */
  auth?: boolean;
  /** Internal flag to avoid infinite refresh loops. */
  _retried?: boolean;
}

export interface ApiResult<T> {
  data: T;
  meta?: PageMeta;
}

/** Attempt to refresh the access token using the stored refresh token. */
async function refreshTokens(): Promise<boolean> {
  const refresh = tokenStore.refresh;
  if (!refresh) return false;

  const tokens = await refreshTokenPair(refresh);
  if (!tokens) return false;
  tokenStore.set(tokens.access_token, tokens.refresh_token);
  return true;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const res = await authorizedFetch(path, options);

  if (res.status === 204) {
    return { data: undefined as T };
  }

  let json: Envelope<T>;
  try {
    json = (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiError(res.status, "invalid_response", res.statusText);
  }

  if (!res.ok || json.success === false) {
    const err = json.error;
    throw new ApiError(
      res.status,
      err?.code ?? "error",
      err?.message ?? "Request failed",
      err?.fields,
      json.data,
    );
  }

  return { data: json.data as T, meta: json.meta };
}

async function authorizedFetch(
  path: string,
  options: RequestOptions = {},
): Promise<Response> {
  const { body, auth = true, _retried, headers, ...rest } = options;

  const finalHeaders = new Headers(headers);
  if (body !== undefined && !finalHeaders.has("Content-Type")) {
    finalHeaders.set("Content-Type", "application/json");
  }
  if (auth) {
    const token = tokenStore.access;
    if (token) finalHeaders.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${config.apiBaseUrl}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth && !_retried) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      return authorizedFetch(path, { ...options, _retried: true });
    }
    clearAuthSession();
    redirectToLogin();
  }

  return res;
}

/** Download a binary response (e.g. CSV export) with auth and token refresh. */
export async function downloadBlob(
  path: string,
  options: RequestOptions = {},
): Promise<Blob> {
  const res = await authorizedFetch(path, { ...options, method: "GET" });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const json = (await res.json()) as Envelope<unknown>;
      message = json.error?.message ?? message;
    } catch {
      // Non-JSON error body — keep status text.
    }
    throw new ApiError(res.status, "download_failed", message);
  }

  return res.blob();
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
  downloadBlob,
};

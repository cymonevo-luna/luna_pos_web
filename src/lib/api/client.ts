import { config } from "@/lib/config";
import {
  clearSessionAndRedirectToLogin,
  ensureFreshAccessToken,
  isAuthExemptApiPath,
  isLoginRoute,
  performSessionRefresh,
} from "@/lib/auth/session-refresh";
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

const IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const MAX_RATE_LIMIT_ATTEMPTS = 3;
const DEFAULT_RETRY_AFTER_SECONDS = 2;
const MAX_RATE_LIMIT_WAIT_SECONDS = 30;

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Attach the bearer access token. Defaults to true. */
  auth?: boolean;
  /**
   * Allow automatic retry on 429 for non-idempotent methods (POST, PUT, PATCH, DELETE).
   * Idempotent methods are retried by default.
   */
  retrySafe?: boolean;
  /** Internal flag to avoid infinite refresh loops. */
  _retried?: boolean;
  /** Internal counter for rate-limit retry attempts (1-based). */
  _rateLimitAttempt?: number;
}

function isIdempotentRetryable(
  method: string | undefined,
  retrySafe?: boolean,
): boolean {
  const normalized = (method ?? "GET").toUpperCase();
  return IDEMPOTENT_METHODS.has(normalized) || retrySafe === true;
}

function parseRetryAfterSeconds(header: string | null): number {
  if (!header) return DEFAULT_RETRY_AFTER_SECONDS;
  const seconds = Number.parseInt(header, 10);
  return Number.isFinite(seconds) && seconds > 0
    ? seconds
    : DEFAULT_RETRY_AFTER_SECONDS;
}

function rateLimitWaitSeconds(
  retryAfterHeader: string | null,
  attemptIndex: number,
): number {
  const base = parseRetryAfterSeconds(retryAfterHeader);
  return Math.min(base * 2 ** attemptIndex, MAX_RATE_LIMIT_WAIT_SECONDS);
}

async function isRateLimitedResponse(res: Response): Promise<boolean> {
  try {
    const json = (await res.clone().json()) as Envelope<unknown>;
    return json.success === false && json.error?.code === "rate_limited";
  } catch {
    return false;
  }
}

function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export interface ApiResult<T> {
  data: T;
  meta?: PageMeta;
}

const inFlightGets = new Map<string, Promise<ApiResult<unknown>>>();

function getDedupeKey(path: string): string {
  return `GET:${path}`;
}

/** Clears in-flight GET dedupe state between tests. */
export function resetInFlightGetsForTests() {
  inFlightGets.clear();
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
  const {
    body,
    auth = true,
    retrySafe,
    _retried,
    _rateLimitAttempt = 1,
    headers,
    signal,
    method,
    ...rest
  } = options;
  const shouldAuthenticate =
    auth && !isAuthExemptApiPath(path) && !isLoginRoute();
  const hasStoredTokens = !!(tokenStore.access || tokenStore.refresh);

  if (shouldAuthenticate && hasStoredTokens) {
    const fresh = await ensureFreshAccessToken();
    if (!fresh) {
      clearSessionAndRedirectToLogin();
      return new Response(null, { status: 401, statusText: "Unauthorized" });
    }
  }

  const finalHeaders = new Headers(headers);
  if (body !== undefined && !finalHeaders.has("Content-Type")) {
    finalHeaders.set("Content-Type", "application/json");
  }
  if (shouldAuthenticate) {
    const token = tokenStore.access;
    if (token) finalHeaders.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${config.apiBaseUrl}${path}`, {
    ...rest,
    method,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  if (res.status === 401 && shouldAuthenticate && !_retried) {
    const refreshed = await performSessionRefresh();
    if (refreshed) {
      return authorizedFetch(path, { ...options, _retried: true });
    }
    clearSessionAndRedirectToLogin();
    return res;
  }

  if (
    res.status === 429 &&
    _rateLimitAttempt < MAX_RATE_LIMIT_ATTEMPTS &&
    !signal?.aborted &&
    isIdempotentRetryable(method, retrySafe) &&
    (await isRateLimitedResponse(res))
  ) {
    const waitSeconds = rateLimitWaitSeconds(
      res.headers.get("Retry-After"),
      _rateLimitAttempt - 1,
    );
    console.debug(
      `[api] rate limited on ${method ?? "GET"} ${path}; retrying in ${waitSeconds}s (attempt ${_rateLimitAttempt}/${MAX_RATE_LIMIT_ATTEMPTS})`,
    );

    try {
      await sleep(waitSeconds * 1000, signal);
    } catch {
      return res;
    }

    if (signal?.aborted) {
      return res;
    }

    return authorizedFetch(path, {
      ...options,
      _rateLimitAttempt: _rateLimitAttempt + 1,
    });
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
  get: <T>(path: string, options?: RequestOptions) => {
    const key = getDedupeKey(path);
    const existing = inFlightGets.get(key);
    if (existing) {
      return existing as Promise<ApiResult<T>>;
    }
    const promise = request<T>(path, { ...options, method: "GET" }).finally(
      () => {
        inFlightGets.delete(key);
      },
    );
    inFlightGets.set(key, promise as Promise<ApiResult<unknown>>);
    return promise;
  },
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

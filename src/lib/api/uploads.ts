import { config } from "@/lib/config";
import {
  clearSessionAndRedirectToLogin,
  ensureFreshAccessToken,
  isLoginRoute,
  performSessionRefresh,
} from "@/lib/auth/session-refresh";
import { tokenStore } from "@/lib/auth/tokens";
import { ApiError } from "./client";
import type { Envelope } from "./types";

export const MENU_PHOTO_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MENU_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export interface PhotoUploadResult {
  url: string;
  filename: string;
  size_bytes: number;
}

export type MenuPhotoUploadResult = PhotoUploadResult;
export type PurchasePhotoUploadResult = PhotoUploadResult;

/** Client-side validation before calling the upload API. */
export function validateMenuPhotoFile(file: File): string | null {
  if (
    !MENU_PHOTO_ALLOWED_TYPES.includes(
      file.type as (typeof MENU_PHOTO_ALLOWED_TYPES)[number],
    )
  ) {
    return "File must be a JPEG, PNG, or WebP image";
  }
  if (file.size > MENU_PHOTO_MAX_BYTES) {
    return "Image must be 5 MB or smaller";
  }
  return null;
}

async function uploadMenuPhotoRequest(
  file: File,
  _retried = false,
): Promise<MenuPhotoUploadResult> {
  if (!isLoginRoute() && (tokenStore.access || tokenStore.refresh)) {
    const fresh = await ensureFreshAccessToken();
    if (!fresh) {
      clearSessionAndRedirectToLogin();
      throw new ApiError(401, "unauthorized", "Session expired");
    }
  }

  const formData = new FormData();
  formData.append("file", file);

  const headers = new Headers();
  if (!isLoginRoute()) {
    const token = tokenStore.access;
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${config.apiBaseUrl}/api/admin/uploads/menu-photo`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (res.status === 401 && !_retried && !isLoginRoute()) {
    const refreshed = await performSessionRefresh();
    if (refreshed) {
      return uploadMenuPhotoRequest(file, true);
    }
    clearSessionAndRedirectToLogin();
  }

  let json: Envelope<MenuPhotoUploadResult>;
  try {
    json = (await res.json()) as Envelope<MenuPhotoUploadResult>;
  } catch {
    throw new ApiError(res.status, "invalid_response", res.statusText);
  }

  if (!res.ok || json.success === false) {
    const err = json.error;
    throw new ApiError(
      res.status,
      err?.code ?? "error",
      err?.message ?? "Upload failed",
      err?.fields,
    );
  }

  return json.data as MenuPhotoUploadResult;
}

/** Upload a menu photo and return the hosted URL for `photo_url`. */
export async function uploadMenuPhoto(
  file: File,
): Promise<MenuPhotoUploadResult> {
  const validationError = validateMenuPhotoFile(file);
  if (validationError) {
    throw new ApiError(400, "validation_error", validationError);
  }
  return uploadMenuPhotoRequest(file);
}

async function uploadPurchasePhotoRequest(
  file: File,
  _retried = false,
): Promise<PurchasePhotoUploadResult> {
  if (!isLoginRoute() && (tokenStore.access || tokenStore.refresh)) {
    const fresh = await ensureFreshAccessToken();
    if (!fresh) {
      clearSessionAndRedirectToLogin();
      throw new ApiError(401, "unauthorized", "Session expired");
    }
  }

  const formData = new FormData();
  formData.append("file", file);

  const headers = new Headers();
  if (!isLoginRoute()) {
    const token = tokenStore.access;
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(
    `${config.apiBaseUrl}/api/admin/uploads/purchase-photo`,
    {
      method: "POST",
      headers,
      body: formData,
    },
  );

  if (res.status === 401 && !_retried && !isLoginRoute()) {
    const refreshed = await performSessionRefresh();
    if (refreshed) {
      return uploadPurchasePhotoRequest(file, true);
    }
    clearSessionAndRedirectToLogin();
  }

  let json: Envelope<PurchasePhotoUploadResult>;
  try {
    json = (await res.json()) as Envelope<PurchasePhotoUploadResult>;
  } catch {
    throw new ApiError(res.status, "invalid_response", res.statusText);
  }

  if (!res.ok || json.success === false) {
    const err = json.error;
    throw new ApiError(
      res.status,
      err?.code ?? "error",
      err?.message ?? "Upload failed",
      err?.fields,
    );
  }

  return json.data as PurchasePhotoUploadResult;
}

/** Upload a purchase proof photo and return the hosted URL for `photo_url`. */
export async function uploadPurchasePhoto(
  file: File,
): Promise<PurchasePhotoUploadResult> {
  const validationError = validateMenuPhotoFile(file);
  if (validationError) {
    throw new ApiError(400, "validation_error", validationError);
  }
  return uploadPurchasePhotoRequest(file);
}

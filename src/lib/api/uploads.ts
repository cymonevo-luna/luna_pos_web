import { config } from "@/lib/config";
import { refreshTokenPair } from "@/lib/auth/refresh";
import { tokenStore } from "@/lib/auth/tokens";
import { ApiError } from "./client";
import type { Envelope } from "./types";

export const MENU_PHOTO_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MENU_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export interface MenuPhotoUploadResult {
  url: string;
  filename: string;
  size_bytes: number;
}

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

async function refreshTokens(): Promise<boolean> {
  const refresh = tokenStore.refresh;
  if (!refresh) return false;

  const tokens = await refreshTokenPair(refresh);
  if (!tokens) return false;
  tokenStore.set(tokens.access_token, tokens.refresh_token);
  return true;
}

async function uploadMenuPhotoRequest(
  file: File,
  _retried = false,
): Promise<MenuPhotoUploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  const headers = new Headers();
  const token = tokenStore.access;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${config.apiBaseUrl}/api/admin/uploads/menu-photo`, {
    ...config.apiFetchInit,
    method: "POST",
    headers,
    body: formData,
  });

  if (res.status === 401 && !_retried) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      return uploadMenuPhotoRequest(file, true);
    }
    tokenStore.clear();
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

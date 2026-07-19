import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  uploadMenuPhoto,
  uploadPurchasePhoto,
  validateMenuPhotoFile,
  MENU_PHOTO_MAX_BYTES,
} from "./uploads";
import { tokenStore } from "@/lib/auth/tokens";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createImageFile(
  name: string,
  type: string,
  sizeBytes = 1024,
): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe("validateMenuPhotoFile", () => {
  it("accepts allowed image types within size limit", () => {
    expect(
      validateMenuPhotoFile(createImageFile("photo.jpg", "image/jpeg")),
    ).toBeNull();
    expect(
      validateMenuPhotoFile(createImageFile("photo.png", "image/png")),
    ).toBeNull();
    expect(
      validateMenuPhotoFile(createImageFile("photo.webp", "image/webp")),
    ).toBeNull();
  });

  it("rejects unsupported file types", () => {
    expect(
      validateMenuPhotoFile(createImageFile("doc.pdf", "application/pdf")),
    ).toBe("File must be a JPEG, PNG, or WebP image");
  });

  it("rejects files larger than 5 MB", () => {
    expect(
      validateMenuPhotoFile(
        createImageFile("large.jpg", "image/jpeg", MENU_PHOTO_MAX_BYTES + 1),
      ),
    ).toBe("Image must be 5 MB or smaller");
  });
});

describe("uploadMenuPhoto", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads with FormData and bearer auth", async () => {
    tokenStore.set("token-abc", "refresh-abc");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          url: "http://localhost:8080/static/uploads/menus/test.webp",
          filename: "test.webp",
          size_bytes: 1024,
        },
      }),
    );

    const file = createImageFile("test.webp", "image/webp");
    const result = await uploadMenuPhoto(file);

    expect(result).toEqual({
      url: "http://localhost:8080/static/uploads/menus/test.webp",
      filename: "test.webp",
      size_bytes: 1024,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8080/api/admin/uploads/menu-photo");
    expect(init?.method).toBe("POST");

    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
    expect(headers.get("Content-Type")).toBeNull();

    const body = init?.body as FormData;
    expect(body.get("file")).toBe(file);
  });

  it("throws ApiError on failed upload response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: { code: "invalid_file", message: "Unsupported image" },
        },
        422,
      ),
    );

    await expect(
      uploadMenuPhoto(createImageFile("bad.gif", "image/gif")),
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      message: "File must be a JPEG, PNG, or WebP image",
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: { code: "invalid_file", message: "Unsupported image" },
        },
        422,
      ),
    );

    await expect(
      uploadMenuPhoto(createImageFile("photo.jpg", "image/jpeg")),
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 422,
      code: "invalid_file",
      message: "Unsupported image",
    });
  });

  it("refreshes the token once on a 401 and retries", async () => {
    tokenStore.set("expired", "refresh-1");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ success: false }, 401))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: { tokens: { access_token: "new", refresh_token: "newR" } },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            url: "http://localhost:8080/static/uploads/menus/retry.webp",
            filename: "retry.webp",
            size_bytes: 512,
          },
        }),
      );

    const result = await uploadMenuPhoto(
      createImageFile("retry.webp", "image/webp", 512),
    );

    expect(result.url).toBe(
      "http://localhost:8080/static/uploads/menus/retry.webp",
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(tokenStore.access).toBe("new");
  });
});

describe("uploadPurchasePhoto", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads with FormData to the purchase-proof endpoint", async () => {
    tokenStore.set("token-abc", "refresh-abc");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          url: "http://localhost:8080/static/uploads/purchases/receipt.webp",
          filename: "receipt.webp",
          size_bytes: 1024,
        },
      }),
    );

    const file = createImageFile("receipt.webp", "image/webp");
    const result = await uploadPurchasePhoto(file);

    expect(result).toEqual({
      url: "http://localhost:8080/static/uploads/purchases/receipt.webp",
      filename: "receipt.webp",
      size_bytes: 1024,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8080/api/admin/uploads/purchase-proof");
    expect(init?.method).toBe("POST");

    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");

    const body = init?.body as FormData;
    expect(body.get("file")).toBe(file);
  });
});

describe("uploadBranchAssetPhoto", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads with FormData to the branch-asset-photo endpoint", async () => {
    tokenStore.set("token-abc", "refresh-abc");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          url: "http://localhost:8080/static/uploads/branch-assets/chair.webp",
          filename: "chair.webp",
          size_bytes: 2048,
        },
      }),
    );

    const file = createImageFile("chair.webp", "image/webp");
    const { uploadBranchAssetPhoto } = await import("./uploads");
    const result = await uploadBranchAssetPhoto(file);

    expect(result).toEqual({
      url: "http://localhost:8080/static/uploads/branch-assets/chair.webp",
      filename: "chair.webp",
      size_bytes: 2048,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/uploads/branch-asset-photo",
    );
    expect(init?.method).toBe("POST");

    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");

    const body = init?.body as FormData;
    expect(body.get("file")).toBe(file);
  });
});

describe("uploadStaffKtpPhoto", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads with FormData to the staff-ktp-photo endpoint", async () => {
    tokenStore.set("token-abc", "refresh-abc");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        {
          success: true,
          data: {
            url: "http://localhost:8080/static/uploads/staff-ktp/ktp.webp",
            filename: "ktp.webp",
            size_bytes: 2048,
          },
        },
        201,
      ),
    );

    const file = createImageFile("ktp.webp", "image/webp");
    const { uploadStaffKtpPhoto } = await import("./uploads");
    const result = await uploadStaffKtpPhoto(file);

    expect(result).toEqual({
      url: "http://localhost:8080/static/uploads/staff-ktp/ktp.webp",
      filename: "ktp.webp",
      size_bytes: 2048,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/uploads/staff-ktp-photo",
    );
    expect(init?.method).toBe("POST");

    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");

    const body = init?.body as FormData;
    expect(body.get("file")).toBe(file);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getAdminStoreSettings,
  updateAdminStoreSettings,
  storeSettingsFormToPayload,
} from "./store-settings";
import { storeSettingsSchema } from "@/lib/validations";
import { tokenStore } from "@/lib/auth/tokens";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const storeSettings = {
  brand_name: "Luna Cafe",
  branch_name: "Downtown",
  address: "123 Main St",
  phone: "+62 812 3456 7890",
  thank_you_note: "Thank you for visiting!",
};

describe("storeSettingsSchema", () => {
  it("accepts a valid payload", () => {
    expect(storeSettingsSchema.safeParse(storeSettings).success).toBe(true);
  });

  it("accepts an empty thank you note", () => {
    expect(
      storeSettingsSchema.safeParse({
        ...storeSettings,
        thank_you_note: "",
      }).success,
    ).toBe(true);
  });

  it("rejects an empty brand name", () => {
    const result = storeSettingsSchema.safeParse({
      ...storeSettings,
      brand_name: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message.includes("Brand name")),
      ).toBe(true);
    }
  });

  it("rejects an empty branch name", () => {
    const result = storeSettingsSchema.safeParse({
      ...storeSettings,
      branch_name: "   ",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message.includes("Branch name")),
      ).toBe(true);
    }
  });

  it("rejects an empty address", () => {
    const result = storeSettingsSchema.safeParse({
      ...storeSettings,
      address: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message.includes("Address")),
      ).toBe(true);
    }
  });

  it("rejects an empty phone", () => {
    const result = storeSettingsSchema.safeParse({
      ...storeSettings,
      phone: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message.includes("Phone")),
      ).toBe(true);
    }
  });
});

describe("store settings API client", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET uses the correct URL and attaches authorization", async () => {
    tokenStore.set("token-abc", "refresh-abc");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        jsonResponse({ success: true, data: storeSettings }),
      );

    const result = await getAdminStoreSettings();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8080/api/admin/store-settings");
    expect(init?.method ?? "GET").toBe("GET");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
    expect(result.data).toEqual(storeSettings);
  });

  it("PUT sends the payload with correct URL, method, and headers", async () => {
    tokenStore.set("token-abc", "refresh-abc");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        jsonResponse({ success: true, data: storeSettings }),
      );

    const payload = {
      brand_name: "Luna Cafe",
      branch_name: "Uptown",
      address: "456 Oak Ave",
      phone: "+62 812 0000 0000",
      thank_you_note: "See you again!",
    };

    const result = await updateAdminStoreSettings(payload);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8080/api/admin/store-settings");
    expect(init?.method).toBe("PUT");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual(payload);
    expect(result.data).toEqual(storeSettings);
  });
});

describe("storeSettingsFormToPayload", () => {
  it("trims all fields and normalizes an empty thank you note", () => {
    expect(
      storeSettingsFormToPayload({
        brand_name: "  Luna Cafe  ",
        branch_name: " Downtown ",
        address: " 123 Main St ",
        phone: " +62 812 3456 7890 ",
        thank_you_note: "",
      }),
    ).toEqual({
      brand_name: "Luna Cafe",
      branch_name: "Downtown",
      address: "123 Main St",
      phone: "+62 812 3456 7890",
      thank_you_note: "",
    });
  });
});

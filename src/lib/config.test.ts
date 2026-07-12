import { describe, it, expect, afterEach, vi } from "vitest";
import { config, normalizeApiBaseUrl } from "./config";

describe("normalizeApiBaseUrl", () => {
  it("removes trailing slashes", () => {
    expect(normalizeApiBaseUrl("https://pos-api.cymonevo.com/")).toBe(
      "https://pos-api.cymonevo.com",
    );
    expect(normalizeApiBaseUrl("https://pos-api.cymonevo.com///")).toBe(
      "https://pos-api.cymonevo.com",
    );
  });

  it("leaves URLs without trailing slash unchanged", () => {
    expect(normalizeApiBaseUrl("https://pos-api.cymonevo.com")).toBe(
      "https://pos-api.cymonevo.com",
    );
  });
});

describe("config", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  it("uses omit credentials for cross-origin API fetches", () => {
    expect(config.apiFetchInit.credentials).toBe("omit");
  });

  it("falls back when NEXT_PUBLIC_API_URL is empty", async () => {
    process.env.NEXT_PUBLIC_API_URL = "   ";
    vi.resetModules();
    const { config: reloaded } = await import("./config");
    expect(reloaded.apiBaseUrl).toBe("http://localhost:8080");
  });

  it("normalizes NEXT_PUBLIC_API_URL from the environment", async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://pos-api.cymonevo.com/";
    vi.resetModules();
    const { config: reloaded } = await import("./config");
    expect(reloaded.apiBaseUrl).toBe("https://pos-api.cymonevo.com");
  });
});

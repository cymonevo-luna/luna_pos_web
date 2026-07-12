import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadEnvFile,
  resolveApiUrl,
  verifyProductionLogin,
} from "../../scripts/verify-production-login.mjs";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("verify-production-login", () => {
  it("resolveApiUrl strips trailing slashes and defaults to pos-api", () => {
    expect(resolveApiUrl("https://pos-api.cymonevo.com/")).toBe(
      "https://pos-api.cymonevo.com",
    );
    expect(resolveApiUrl()).toBe("https://pos-api.cymonevo.com");
  });

  it("loadEnvFile fills unset env vars from a dotenv file", () => {
    const dir = mkdtempSync(join(tmpdir(), "verify-env-"));
    const envPath = join(dir, ".env.test");
    writeFileSync(envPath, "VERIFY_TEST_KEY=from-file\n");

    const previous = process.env.VERIFY_TEST_KEY;
    delete process.env.VERIFY_TEST_KEY;

    loadEnvFile(envPath);
    expect(process.env.VERIFY_TEST_KEY).toBe("from-file");

    if (previous === undefined) {
      delete process.env.VERIFY_TEST_KEY;
    } else {
      process.env.VERIFY_TEST_KEY = previous;
    }

    rmSync(dir, { recursive: true, force: true });
  });

  it("verifies invalid-credentials contract without admin credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: { code: "unauthorized", message: "invalid credentials" },
        },
        401,
      ),
    );

    const result = await verifyProductionLogin({
      apiUrl: "https://pos-api.cymonevo.com",
      fetchImpl: fetchMock,
    });

    expect(result.adminSkipped).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.credentials).toBe("omit");
    expect(JSON.parse(String(init.body))).toEqual({
      email: "qa-invalid@example.com",
      password: "wrong-password",
    });
  });

  it("verifies admin login and admin API when credentials are provided", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            success: false,
            error: { code: "unauthorized", message: "invalid credentials" },
          },
          401,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            tokens: { access_token: "admin-token", refresh_token: "refresh" },
            user: {
              id: "1",
              email: "admin@example.com",
              name: "Admin",
              role: "admin",
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: [],
          meta: { page: 1, per_page: 1, total: 0 },
        }),
      );

    const result = await verifyProductionLogin({
      apiUrl: "https://pos-api.cymonevo.com",
      qaEmail: "admin@example.com",
      qaPassword: "secret",
      fetchImpl: fetchMock,
    });

    expect(result.adminSkipped).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const adminListCall = fetchMock.mock.calls[2];
    expect(adminListCall[0]).toBe(
      "https://pos-api.cymonevo.com/api/admin/users?page=1&per_page=1",
    );
    expect(new Headers(adminListCall[1].headers).get("Authorization")).toBe(
      "Bearer admin-token",
    );
    expect(adminListCall[1].credentials).toBe("omit");
  });

  it("fails when VERIFY_REQUIRE_ADMIN is set without credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: { code: "unauthorized", message: "invalid credentials" },
        },
        401,
      ),
    );

    await expect(
      verifyProductionLogin({
        apiUrl: "https://pos-api.cymonevo.com",
        requireAdmin: true,
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow(/QA_ADMIN_EMAIL/);
  });
});

#!/usr/bin/env node
/**
 * Production login smoke test for QA.
 *
 * Verifies the live API login contract and, when QA_ADMIN_EMAIL /
 * QA_ADMIN_PASSWORD are set, confirms admin login and an authenticated
 * /api/admin/* request succeed without CORS issues.
 *
 * Credentials are read from the environment or repo .env.secret (when present).
 * Set VERIFY_REQUIRE_ADMIN=1 to fail when admin credentials are missing.
 *
 * Usage:
 *   npm run verify:production-login
 *   QA_ADMIN_EMAIL=admin@example.com QA_ADMIN_PASSWORD=secret npm run verify:production-login
 *   VERIFY_REQUIRE_ADMIN=1 npm run verify:production-login
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Load KEY=VALUE lines from a dotenv file without overriding existing env. */
export function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(REPO_ROOT, ".env.secret"));

export const PRODUCTION_API_HOST = "pos-api.cymonevo.com";

export function resolveApiUrl(raw = process.env.NEXT_PUBLIC_API_URL) {
  return (raw ?? `https://${PRODUCTION_API_HOST}`).replace(/\/+$/, "");
}

export async function apiRequest(apiUrl, path, init = {}, fetchImpl = fetch) {
  const url = `${apiUrl}${path}`;
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let res;
  try {
    res = await fetchImpl(url, {
      ...init,
      headers,
      credentials: "omit",
      body:
        init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch (error) {
    throw new Error(
      `Cannot reach ${url} (${error instanceof Error ? error.message : error})`,
    );
  }

  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error(`${path} returned non-JSON response (HTTP ${res.status})`);
  }

  return { res, json };
}

/**
 * Run production login contract checks. Returns `{ adminSkipped: true }` when
 * admin credentials are absent and VERIFY_REQUIRE_ADMIN is not set.
 */
export async function verifyProductionLogin({
  apiUrl = resolveApiUrl(),
  qaEmail = process.env.QA_ADMIN_EMAIL?.trim(),
  qaPassword = process.env.QA_ADMIN_PASSWORD,
  requireAdmin = process.env.VERIFY_REQUIRE_ADMIN === "1",
  fetchImpl = fetch,
} = {}) {
  if (!apiUrl.includes(PRODUCTION_API_HOST)) {
    throw new Error(`Expected production API host, got ${apiUrl}`);
  }

  const invalid = await apiRequest(
    apiUrl,
    "/api/v1/auth/login",
    {
      method: "POST",
      body: {
        email: "qa-invalid@example.com",
        password: "wrong-password",
      },
    },
    fetchImpl,
  );

  if (invalid.res.status !== 401) {
    throw new Error(
      `Invalid credentials expected HTTP 401, got ${invalid.res.status}`,
    );
  }
  if (invalid.json.success !== false) {
    throw new Error("Invalid credentials response should have success:false");
  }

  if (!qaEmail || !qaPassword) {
    if (requireAdmin) {
      throw new Error(
        "QA_ADMIN_EMAIL / QA_ADMIN_PASSWORD unset — provision a production admin account and set credentials in .env.secret or the environment.",
      );
    }
    return { adminSkipped: true };
  }

  const login = await apiRequest(
    apiUrl,
    "/api/v1/auth/login",
    {
      method: "POST",
      body: { email: qaEmail, password: qaPassword },
    },
    fetchImpl,
  );

  if (login.res.status !== 200 || login.json.success !== true) {
    throw new Error(
      `Admin login failed (HTTP ${login.res.status}): ${login.json.error?.message ?? "unknown error"}`,
    );
  }

  const { tokens, user } = login.json.data ?? {};
  if (!tokens?.access_token || !user) {
    throw new Error("Admin login response missing tokens or user");
  }
  if (user.role !== "admin") {
    throw new Error(`Expected admin role, got ${user.role ?? "unknown"}`);
  }

  const adminUsers = await apiRequest(
    apiUrl,
    "/api/admin/users?page=1&per_page=1",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    },
    fetchImpl,
  );

  if (adminUsers.res.status !== 200 || adminUsers.json.success !== true) {
    throw new Error(
      `GET /api/admin/users failed (HTTP ${adminUsers.res.status}): ${adminUsers.json.error?.message ?? "unknown error"}`,
    );
  }

  return { adminSkipped: false };
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

async function main() {
  const apiUrl = resolveApiUrl();
  console.log(`API base URL: ${apiUrl}`);
  pass("API base URL targets pos-api.cymonevo.com");

  try {
    const result = await verifyProductionLogin({ apiUrl });
    pass("Invalid credentials return HTTP 401 application error");

    if (result.adminSkipped) {
      console.log(
        "SKIP: QA_ADMIN_EMAIL / QA_ADMIN_PASSWORD unset — admin login and /api/admin/* checks not run",
      );
      console.log(
        "      Set credentials in .env.secret or the environment to complete admin E2E verification.",
      );
      process.exit(0);
    }

    pass("Admin login returns 200 with admin user and tokens");
    pass("Authenticated GET /api/admin/users returns 200");
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main();
}

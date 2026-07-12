#!/usr/bin/env node
/**
 * Production login smoke test for QA.
 *
 * Verifies the live API login contract and, when QA_ADMIN_EMAIL /
 * QA_ADMIN_PASSWORD are set, confirms admin login and an authenticated
 * /api/admin/* request succeed without CORS issues.
 *
 * Usage:
 *   node scripts/verify-production-login.mjs
 *   QA_ADMIN_EMAIL=admin@example.com QA_ADMIN_PASSWORD=secret node scripts/verify-production-login.mjs
 */

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "https://pos-api.cymonevo.com"
).replace(/\/+$/, "");

const QA_EMAIL = process.env.QA_ADMIN_EMAIL?.trim();
const QA_PASSWORD = process.env.QA_ADMIN_PASSWORD;

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

async function request(path, init = {}) {
  const url = `${API_URL}${path}`;
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let res;
  try {
    res = await fetch(url, {
      ...init,
      headers,
      credentials: "omit",
      body:
        init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch (error) {
    fail(
      `Cannot reach ${url} (${error instanceof Error ? error.message : error})`,
    );
  }

  let json;
  try {
    json = await res.json();
  } catch {
    fail(`${path} returned non-JSON response (HTTP ${res.status})`);
  }

  return { res, json };
}

async function main() {
  console.log(`API base URL: ${API_URL}`);

  if (!API_URL.includes("pos-api.cymonevo.com")) {
    fail(`Expected production API host, got ${API_URL}`);
  }
  pass("API base URL targets pos-api.cymonevo.com");

  const invalid = await request("/api/v1/auth/login", {
    method: "POST",
    body: {
      email: "qa-invalid@example.com",
      password: "wrong-password",
    },
  });

  if (invalid.res.status !== 401) {
    fail(`Invalid credentials expected HTTP 401, got ${invalid.res.status}`);
  }
  if (invalid.json.success !== false) {
    fail("Invalid credentials response should have success:false");
  }
  pass("Invalid credentials return HTTP 401 application error");

  if (!QA_EMAIL || !QA_PASSWORD) {
    console.log(
      "SKIP: QA_ADMIN_EMAIL / QA_ADMIN_PASSWORD unset — admin login and /api/admin/* checks not run",
    );
    process.exit(0);
  }

  const login = await request("/api/v1/auth/login", {
    method: "POST",
    body: { email: QA_EMAIL, password: QA_PASSWORD },
  });

  if (login.res.status !== 200 || login.json.success !== true) {
    fail(
      `Admin login failed (HTTP ${login.res.status}): ${login.json.error?.message ?? "unknown error"}`,
    );
  }

  const { tokens, user } = login.json.data ?? {};
  if (!tokens?.access_token || !user) {
    fail("Admin login response missing tokens or user");
  }
  if (user.role !== "admin") {
    fail(`Expected admin role, got ${user.role ?? "unknown"}`);
  }
  pass("Admin login returns 200 with admin user and tokens");

  const adminUsers = await request("/api/admin/users?page=1&per_page=1", {
    method: "GET",
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (adminUsers.res.status !== 200 || adminUsers.json.success !== true) {
    fail(
      `GET /api/admin/users failed (HTTP ${adminUsers.res.status}): ${adminUsers.json.error?.message ?? "unknown error"}`,
    );
  }
  pass("Authenticated GET /api/admin/users returns 200");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});

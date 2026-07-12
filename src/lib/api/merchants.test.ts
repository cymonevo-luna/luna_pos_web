import { describe, it, expect, vi, beforeEach } from "vitest";
import { merchantsApi } from "./merchants";

function jsonResponse(body: unknown, status = 201) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("merchantsApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("posts merchant registration payload to the merchants register endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          tokens: {
            access_token: "access",
            refresh_token: "refresh",
            expires_in: 900,
          },
          user: {
            id: "user-1",
            email: "owner@example.com",
            name: "Owner",
            roles: ["admin"],
            merchant_id: "merchant-1",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
          merchant: {
            id: "merchant-1",
            name: "Luna Cafe",
            address: "123 Main Street",
            phone: "+62 812 3456 7890",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        },
      }),
    );

    const payload = {
      merchant_name: "Luna Cafe",
      address: "123 Main Street",
      phone: "+62 812 3456 7890",
      admin_email: "owner@example.com",
      admin_name: "Owner",
      admin_password: "password123",
    };

    const res = await merchantsApi.register(payload);

    expect(res.data.merchant.name).toBe("Luna Cafe");
    expect(res.data.user.roles).toEqual(["admin"]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8080/api/v1/merchants/register");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual(payload);
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import { config } from "@/lib/config";
import {
  supplierFormToPayload,
  suppliersAdminApi,
} from "@/lib/api/suppliers";
import type { Supplier } from "@/lib/api/types";
import { loginAsTestAccount } from "@/testing/auth";
import { tokenStore } from "@/lib/auth/tokens";

async function assertApiReachable(): Promise<void> {
  try {
    const res = await fetch(`${config.apiBaseUrl}/healthz`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      throw new Error(
        `API health check failed at ${config.apiBaseUrl}/healthz (HTTP ${res.status}). ` +
          "Start luna_pos_service with `make docker-up` in the sibling repo.",
      );
    }
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "unknown connection error";
    throw new Error(
      `API unreachable at ${config.apiBaseUrl}/healthz: ${detail}. ` +
        "Start luna_pos_service with `make docker-up` in the sibling repo.",
    );
  }
}

function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}`;
}

/**
 * Live API verification for POS-17-2. Requires luna_pos_service with migrations applied.
 * Supplier admin routes require the operational role (not admin-only).
 * Set RUN_INTEGRATION_TESTS=1 and ensure NEXT_PUBLIC_API_URL points at the API.
 */
describe("POS-17-2 admin dashboard supplier create flow (live API)", () => {
  beforeAll(async () => {
    if (process.env.RUN_INTEGRATION_TESTS === "1") {
      await assertApiReachable();
    }
  });

  it("1. Dashboard create supplier form succeeds (Toko Aji ticket payload)", async () => {
    if (process.env.RUN_INTEGRATION_TESTS !== "1") {
      return;
    }

    tokenStore.clear();
    await loginAsTestAccount("operational");

    const payload = supplierFormToPayload({
      name: uniqueName("Toko Aji"),
      phone_number: "08161974323",
      address: "Jl Cempaka Putih Tengah",
      supports_delivery: true,
      delivery_cost: 0,
    });

    const result = await suppliersAdminApi.create(payload);
    expect(result.data.id).toBeTruthy();
    expect(result.data.name).toContain("Toko Aji");
    expect(result.data.phone_number).toBe("08161974323");
    expect(result.data.address).toBe("Jl Cempaka Putih Tengah");
    expect(result.data.supports_delivery).toBe(true);
    expect(result.data.delivery_cost).toBe(0);
  });

  it("2. New supplier appears in dashboard list with correct fields", async () => {
    if (process.env.RUN_INTEGRATION_TESTS !== "1") {
      return;
    }

    tokenStore.clear();
    await loginAsTestAccount("operational");

    const name = uniqueName("Toko Aji");
    const created = await suppliersAdminApi.create(
      supplierFormToPayload({
        name,
        phone_number: "08161974323",
        address: "Jl Cempaka Putih Tengah",
        supports_delivery: true,
        delivery_cost: 0,
      }),
    );

    const list = await suppliersAdminApi.list({ search: name, perPage: 10 });
    const match = list.data.find((item) => item.id === created.data.id);
    expect(match).toBeDefined();
    expect(match?.name).toBe(name);
    expect(match?.phone_number).toBe("08161974323");
    expect(match?.address).toBe("Jl Cempaka Putih Tengah");
  });

  it("3. Dashboard edit supplier saves changes", async () => {
    if (process.env.RUN_INTEGRATION_TESTS !== "1") {
      return;
    }

    tokenStore.clear();
    await loginAsTestAccount("operational");

    const created = await suppliersAdminApi.create(
      supplierFormToPayload({
        name: uniqueName("Toko Aji"),
        phone_number: "08161974323",
        address: "Jl Cempaka Putih Tengah",
        supports_delivery: true,
        delivery_cost: 0,
      }),
    );

    const updatedName = uniqueName("Toko Aji Updated");
    const updated = await suppliersAdminApi.update(
      created.data.id,
      supplierFormToPayload({
        name: updatedName,
        phone_number: "08161974323",
        address: "Jl Cempaka Putih Tengah",
        supports_delivery: true,
        delivery_cost: 5000,
      }),
    );

    expect(updated.data.name).toBe(updatedName);
    expect(updated.data.delivery_cost).toBe(5000);

    const detail = await suppliersAdminApi.get(created.data.id);
    expect(detail.data.name).toBe(updatedName);
    expect(detail.data.delivery_cost).toBe(5000);
  });

  it("4. Create supplier without delivery regression (delivery_cost null in response)", async () => {
    if (process.env.RUN_INTEGRATION_TESTS !== "1") {
      return;
    }

    tokenStore.clear();
    await loginAsTestAccount("operational");

    const payload = supplierFormToPayload({
      name: uniqueName("No Delivery Supplier"),
      phone_number: "08123456789",
      address: "Jl Test Address",
      supports_delivery: false,
    });
    expect(payload.delivery_cost).toBeUndefined();

    const created = await suppliersAdminApi.create(payload);
    expect(created.data.supports_delivery).toBe(false);
    expect(created.data.delivery_cost).toBeNull();

    const detail: Supplier = (await suppliersAdminApi.get(created.data.id))
      .data;
    expect(detail.delivery_cost).toBeNull();
  });
});

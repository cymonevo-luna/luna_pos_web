import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminNewSupplierPage from "@/app/admin/(protected)/suppliers/new/page";
import AdminSuppliersPage from "@/app/admin/(protected)/suppliers/page";
import { AdminSupplierDetailContent } from "@/app/admin/(protected)/suppliers/[id]/supplier-detail-content";
import { SupplierForm } from "@/components/admin/supplier-form";
import { suppliersAdminApi } from "@/lib/api/suppliers";
import type { Supplier } from "@/lib/api/types";
import { toast } from "sonner";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/api/suppliers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/suppliers")>();
  return {
    ...actual,
    suppliersAdminApi: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const supplierWithPhone: Supplier = {
  id: "sup-1",
  name: "Beras Supplier",
  phone_number: "08123456789",
  address: "Jl. Pasar 12",
  supports_delivery: false,
  delivery_cost: null,
  price_quotes: [],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

/**
 * Checklist coverage for POS-107-2 — optional supplier phone.
 */
describe("POS-107-2 supplier phone optional verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("3. Create supplier without phone in admin UI", async () => {
    const user = userEvent.setup();
    const createdSupplier: Supplier = {
      ...supplierWithPhone,
      id: "sup-new",
      name: "No Phone Supplier",
      phone_number: "",
    };

    vi.mocked(suppliersAdminApi.create).mockResolvedValue({
      data: createdSupplier,
    });
    vi.mocked(suppliersAdminApi.list).mockResolvedValue({
      data: [createdSupplier],
      meta: { page: 1, per_page: 10, total: 1 },
    });

    render(<AdminNewSupplierPage />);

    await user.type(screen.getByLabelText("Name"), "No Phone Supplier");
    await user.type(screen.getByLabelText("Address"), "Jl. Pasar 12");
    await user.click(screen.getByRole("button", { name: "Create supplier" }));

    await waitFor(() => {
      expect(suppliersAdminApi.create).toHaveBeenCalledWith({
        name: "No Phone Supplier",
        phone_number: "",
        address: "Jl. Pasar 12",
        supports_delivery: false,
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Supplier created");
    expect(push).toHaveBeenCalledWith("/admin/suppliers/sup-new");

    render(<AdminSuppliersPage />);
    expect(await screen.findByText("No Phone Supplier")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("4. Edit supplier to remove phone", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <SupplierForm
        defaultValues={{
          name: supplierWithPhone.name,
          phone_number: supplierWithPhone.phone_number,
          address: supplierWithPhone.address,
          supports_delivery: supplierWithPhone.supports_delivery,
        }}
        onSubmit={onSubmit}
        onCancel={() => {}}
        submitLabel="Save changes"
      />,
    );

    const phoneInput = screen.getByLabelText(/Phone number/);
    await user.clear(phoneInput);
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      name: "Beras Supplier",
      phone_number: "",
      address: "Jl. Pasar 12",
    });

    vi.mocked(suppliersAdminApi.get).mockResolvedValue({
      data: { ...supplierWithPhone, phone_number: "" },
    });

    render(<AdminSupplierDetailContent id="sup-1" />);
    expect(await screen.findByText("Beras Supplier")).toBeInTheDocument();
    expect(screen.getByText("Jl. Pasar 12")).toBeInTheDocument();
    expect(screen.queryByText("08123456789")).not.toBeInTheDocument();
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });

  it("5. Regression create supplier with phone displays on list and detail", async () => {
    vi.mocked(suppliersAdminApi.list).mockResolvedValue({
      data: [supplierWithPhone],
      meta: { page: 1, per_page: 10, total: 1 },
    });
    vi.mocked(suppliersAdminApi.get).mockResolvedValue({
      data: supplierWithPhone,
    });

    render(<AdminSuppliersPage />);
    expect(await screen.findByText("Beras Supplier")).toBeInTheDocument();
    expect(screen.getByText("08123456789")).toBeInTheDocument();

    render(<AdminSupplierDetailContent id="sup-1" />);
    expect(await screen.findByText("Beras Supplier")).toBeInTheDocument();
    expect(
      screen.getByText("08123456789 · Jl. Pasar 12"),
    ).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MerchantRegisterForm } from "./merchant-register-form";
import { ApiError } from "@/lib/api/client";

const registerMerchant = vi.fn();
const push = vi.fn();
const refresh = vi.fn();

vi.mock("@/lib/auth/context", () => ({
  useAuth: () => ({ registerMerchant }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("MerchantRegisterForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all merchant registration fields", () => {
    render(<MerchantRegisterForm />);

    expect(screen.getByLabelText("Merchant Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Address")).toBeInTheDocument();
    expect(screen.getByLabelText("Phone Number")).toBeInTheDocument();
    expect(screen.getByLabelText("Admin Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Admin Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Admin Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm Password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Register merchant" }),
    ).toBeInTheDocument();
  });

  it("blocks password mismatch without calling the API", async () => {
    const user = userEvent.setup();
    render(<MerchantRegisterForm />);

    await user.type(screen.getByLabelText("Merchant Name"), "Luna Cafe");
    await user.type(screen.getByLabelText("Address"), "123 Main Street");
    await user.type(screen.getByLabelText("Phone Number"), "+62 812 3456 7890");
    await user.type(screen.getByLabelText("Admin Email"), "owner@example.com");
    await user.type(screen.getByLabelText("Admin Name"), "Owner");
    await user.type(screen.getByLabelText("Admin Password"), "password123");
    await user.type(screen.getByLabelText("Confirm Password"), "different");
    await user.click(screen.getByRole("button", { name: "Register merchant" }));

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(registerMerchant).not.toHaveBeenCalled();
  });

  it("redirects after successful registration", async () => {
    const user = userEvent.setup();
    registerMerchant.mockResolvedValue({
      id: "user-1",
      role: "admin",
      roles: ["admin"],
    });

    render(<MerchantRegisterForm />);

    await user.type(screen.getByLabelText("Merchant Name"), "Luna Cafe");
    await user.type(screen.getByLabelText("Address"), "123 Main Street");
    await user.type(screen.getByLabelText("Phone Number"), "+62 812 3456 7890");
    await user.type(screen.getByLabelText("Admin Email"), "owner@example.com");
    await user.type(screen.getByLabelText("Admin Name"), "Owner");
    await user.type(screen.getByLabelText("Admin Password"), "password123");
    await user.type(screen.getByLabelText("Confirm Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Register merchant" }));

    expect(registerMerchant).toHaveBeenCalledWith({
      merchant_name: "Luna Cafe",
      address: "123 Main Street",
      phone: "+62 812 3456 7890",
      admin_email: "owner@example.com",
      admin_name: "Owner",
      admin_password: "password123",
    });
    expect(push).toHaveBeenCalledWith("/admin/users");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows duplicate email error on 409", async () => {
    const user = userEvent.setup();
    registerMerchant.mockRejectedValue(
      new ApiError(409, "conflict", "Email already exists"),
    );

    render(<MerchantRegisterForm />);

    await user.type(screen.getByLabelText("Merchant Name"), "Luna Cafe");
    await user.type(screen.getByLabelText("Address"), "123 Main Street");
    await user.type(screen.getByLabelText("Phone Number"), "+62 812 3456 7890");
    await user.type(screen.getByLabelText("Admin Email"), "owner@example.com");
    await user.type(screen.getByLabelText("Admin Name"), "Owner");
    await user.type(screen.getByLabelText("Admin Password"), "password123");
    await user.type(screen.getByLabelText("Confirm Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Register merchant" }));

    expect(await screen.findByText("Email already exists")).toBeInTheDocument();
  });

  it("maps 422 validation errors onto form fields", async () => {
    const user = userEvent.setup();
    registerMerchant.mockRejectedValue(
      new ApiError(422, "validation_error", "Validation failed", {
        merchant_name: "Merchant name is required",
      }),
    );

    render(<MerchantRegisterForm />);

    await user.type(screen.getByLabelText("Merchant Name"), " ");
    await user.type(screen.getByLabelText("Address"), "123 Main Street");
    await user.type(screen.getByLabelText("Phone Number"), "+62 812 3456 7890");
    await user.type(screen.getByLabelText("Admin Email"), "owner@example.com");
    await user.type(screen.getByLabelText("Admin Name"), "Owner");
    await user.type(screen.getByLabelText("Admin Password"), "password123");
    await user.type(screen.getByLabelText("Confirm Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Register merchant" }));

    expect(
      await screen.findByText("Merchant name is required"),
    ).toBeInTheDocument();
  });
});

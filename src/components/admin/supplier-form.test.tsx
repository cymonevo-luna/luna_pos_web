import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SupplierForm } from "./supplier-form";

describe("SupplierForm", () => {
  it("renders all base fields", () => {
    render(<SupplierForm onSubmit={() => {}} onCancel={() => {}} />);

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone number/)).toBeInTheDocument();
    expect(screen.getByLabelText("Address")).toBeInTheDocument();
    expect(screen.getByLabelText("Supports delivery")).toBeInTheDocument();
  });

  it("toggles delivery cost visibility with supports delivery", async () => {
    const user = userEvent.setup();

    render(<SupplierForm onSubmit={() => {}} onCancel={() => {}} />);

    expect(screen.queryByLabelText("Delivery cost (Rp)")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Supports delivery"));
    expect(screen.getByLabelText("Delivery cost (Rp)")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Supports delivery"));
    expect(screen.queryByLabelText("Delivery cost (Rp)")).not.toBeInTheDocument();
  });

  it("submits valid metadata values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <SupplierForm
        onSubmit={onSubmit}
        onCancel={() => {}}
        submitLabel="Save supplier"
      />,
    );

    await user.type(screen.getByLabelText("Name"), "Beras Supplier");
    await user.type(screen.getByLabelText(/Phone number/), "08123456789");
    await user.type(screen.getByLabelText("Address"), "Jl. Pasar 12");

    await user.click(screen.getByRole("button", { name: "Save supplier" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      name: "Beras Supplier",
      phone_number: "08123456789",
      address: "Jl. Pasar 12",
      supports_delivery: false,
      delivery_cost: undefined,
    });
  });

  it("submits with empty phone number", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<SupplierForm onSubmit={onSubmit} onCancel={() => {}} />);

    await user.type(screen.getByLabelText("Name"), "Beras Supplier");
    await user.type(screen.getByLabelText("Address"), "Jl. Pasar 12");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      name: "Beras Supplier",
      phone_number: "",
      address: "Jl. Pasar 12",
      supports_delivery: false,
      delivery_cost: undefined,
    });
    expect(screen.queryByText(/Phone number must be at least/)).not.toBeInTheDocument();
  });

  it("blocks submit when phone number is too short", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<SupplierForm onSubmit={onSubmit} onCancel={() => {}} />);

    await user.type(screen.getByLabelText("Name"), "Beras Supplier");
    await user.type(screen.getByLabelText(/Phone number/), "0812");
    await user.type(screen.getByLabelText("Address"), "Jl. Pasar 12");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("Phone number must be at least 5 characters"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("blocks submit when name is empty", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<SupplierForm onSubmit={onSubmit} onCancel={() => {}} />);

    await user.type(screen.getByLabelText(/Phone number/), "08123456789");
    await user.type(screen.getByLabelText("Address"), "Jl. Pasar 12");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText(/Name must be at least/),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("blocks submit when delivery is enabled without delivery cost", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<SupplierForm onSubmit={onSubmit} onCancel={() => {}} />);

    await user.type(screen.getByLabelText("Name"), "Beras Supplier");
    await user.type(screen.getByLabelText(/Phone number/), "08123456789");
    await user.type(screen.getByLabelText("Address"), "Jl. Pasar 12");
    await user.click(screen.getByLabelText("Supports delivery"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText(
        "Delivery cost is required when delivery is supported",
      ),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import {
  OrderOptionForm,
  type OrderOptionFormHandle,
} from "./order-option-form";

describe("OrderOptionForm", () => {
  it("submits valid values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <OrderOptionForm
        onSubmit={onSubmit}
        onCancel={() => {}}
        submitLabel="Add Order Option"
      />,
    );

    await user.type(screen.getByLabelText("Name"), "Dine-In");
    await user.click(
      screen.getByRole("button", { name: "Add Order Option" }),
    );

    await waitFor(() => {
      expect(onSubmit.mock.calls[0]?.[0]).toEqual({
        name: "Dine-In",
        additional_price: 0,
      });
    });
  });

  it("renders additional price input with default 0", () => {
    render(
      <OrderOptionForm onSubmit={() => {}} onCancel={() => {}} />,
    );

    expect(screen.getByLabelText("Additional Price (IDR)")).toHaveValue(0);
    expect(
      screen.getByText("Optional; leave 0 for no surcharge"),
    ).toBeInTheDocument();
  });

  it("submits additional price with valid values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <OrderOptionForm
        onSubmit={onSubmit}
        onCancel={() => {}}
        submitLabel="Add Order Option"
      />,
    );

    await user.type(screen.getByLabelText("Name"), "Box");
    await user.clear(screen.getByLabelText("Additional Price (IDR)"));
    await user.type(screen.getByLabelText("Additional Price (IDR)"), "3000");
    await user.click(
      screen.getByRole("button", { name: "Add Order Option" }),
    );

    await waitFor(() => {
      expect(onSubmit.mock.calls[0]?.[0]).toEqual({
        name: "Box",
        additional_price: 3000,
      });
    });
  });

  it("rejects negative additional price", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<OrderOptionForm onSubmit={onSubmit} onCancel={() => {}} />);

    await user.type(screen.getByLabelText("Name"), "Box");
    await user.clear(screen.getByLabelText("Additional Price (IDR)"));
    await user.type(screen.getByLabelText("Additional Price (IDR)"), "-100");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("Additional price cannot be negative"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows validation errors for invalid input", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<OrderOptionForm onSubmit={onSubmit} onCancel={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("Name must be at least 2 characters"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("prefills edit defaults", () => {
    render(
      <OrderOptionForm
        defaultValues={{ name: "Dine-In", additional_price: 5000 }}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByLabelText("Name")).toHaveValue("Dine-In");
    expect(screen.getByLabelText("Additional Price (IDR)")).toHaveValue(5000);
  });

  it("applies server field errors via ref", async () => {
    const ref = createRef<OrderOptionFormHandle>();

    render(
      <OrderOptionForm ref={ref} onSubmit={() => {}} onCancel={() => {}} />,
    );

    ref.current?.applyServerErrors({
      name: "Order option name already exists",
      additional_price: "Additional price is invalid",
    });

    expect(
      await screen.findByText("Order option name already exists"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Additional price is invalid"),
    ).toBeInTheDocument();
  });

  it("calls onCancel without submitting", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onSubmit = vi.fn();

    render(<OrderOptionForm onSubmit={onSubmit} onCancel={onCancel} />);

    await user.type(screen.getByLabelText("Name"), "Dine-In");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

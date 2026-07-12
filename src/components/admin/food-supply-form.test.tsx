import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import {
  FoodSupplyForm,
  type FoodSupplyFormHandle,
} from "./food-supply-form";

describe("FoodSupplyForm", () => {
  it("renders short unit labels in the dropdown", () => {
    render(
      <FoodSupplyForm onSubmit={() => {}} onCancel={() => {}} />,
    );

    const unitSelect = screen.getByLabelText("Unit");
    expect(within(unitSelect).getByRole("option", { name: "ml" })).toBeInTheDocument();
    expect(within(unitSelect).getByRole("option", { name: "gr" })).toBeInTheDocument();
    expect(within(unitSelect).getByRole("option", { name: "pcs" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Millilitre" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Gram" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Piece" })).not.toBeInTheDocument();
  });

  it("shows helper text with short unit labels", () => {
    render(
      <FoodSupplyForm onSubmit={() => {}} onCancel={() => {}} />,
    );

    const helperText = screen.getByText(/Use ml for liquids/);
    expect(helperText).toHaveTextContent("ml");
    expect(helperText).toHaveTextContent("gr");
    expect(helperText).toHaveTextContent("pcs");
    expect(helperText).not.toHaveTextContent("millilitres");
    expect(helperText).not.toHaveTextContent("grams");
  });

  it("submits unit piece when pcs is selected", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <FoodSupplyForm
        onSubmit={onSubmit}
        onCancel={() => {}}
        submitLabel="Add supply"
      />,
    );

    await user.type(screen.getByLabelText("Title"), "Eggs");
    await user.type(screen.getByLabelText("Stock quantity"), "12");
    await user.selectOptions(screen.getByLabelText("Unit"), "piece");
    await user.click(screen.getByRole("button", { name: "Add supply" }));

    await waitFor(() => {
      expect(onSubmit.mock.calls[0]?.[0]).toEqual({
        title: "Eggs",
        description: "",
        stock_quantity: 12,
        unit: "piece",
      });
    });
  });

  it("submits valid values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <FoodSupplyForm
        onSubmit={onSubmit}
        onCancel={() => {}}
        submitLabel="Add supply"
      />,
    );

    await user.type(screen.getByLabelText("Title"), "Tomato Sauce");
    await user.type(screen.getByLabelText(/Description/), "House recipe");
    await user.clear(screen.getByLabelText("Stock quantity"));
    await user.type(screen.getByLabelText("Stock quantity"), "750");
    await user.selectOptions(screen.getByLabelText("Unit"), "ml");
    await user.click(screen.getByRole("button", { name: "Add supply" }));

    await waitFor(() => {
      expect(onSubmit.mock.calls[0]?.[0]).toEqual({
        title: "Tomato Sauce",
        description: "House recipe",
        stock_quantity: 750,
        unit: "ml",
      });
    });
  });

  it("shows validation errors for invalid input", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <FoodSupplyForm onSubmit={onSubmit} onCancel={() => {}} />,
    );

    await user.type(screen.getByLabelText("Title"), "Salt");
    await user.type(screen.getByLabelText("Stock quantity"), "-5");
    await user.selectOptions(screen.getByLabelText("Unit"), "gr");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("Stock quantity cannot be negative"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("requires a title and unit before submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <FoodSupplyForm onSubmit={onSubmit} onCancel={() => {}} />,
    );

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/Title must be at least/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("prefills edit defaults without resetting unit", () => {
    render(
      <FoodSupplyForm
        defaultValues={{
          title: "Sugar",
          description: "White",
          stock_quantity: 1000,
          unit: "gr",
        }}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByLabelText("Title")).toHaveValue("Sugar");
    expect(screen.getByLabelText(/Description/)).toHaveValue("White");
    expect(screen.getByLabelText("Stock quantity")).toHaveValue(1000);
    expect(screen.getByLabelText("Unit")).toHaveValue("gr");
  });

  it("applies server field errors via ref", async () => {
    const ref = createRef<FoodSupplyFormHandle>();

    render(
      <FoodSupplyForm ref={ref} onSubmit={() => {}} onCancel={() => {}} />,
    );

    ref.current?.applyServerErrors({ unit: "Invalid unit value" });

    expect(await screen.findByText("Invalid unit value")).toBeInTheDocument();
  });

  it("calls onCancel without submitting", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onSubmit = vi.fn();

    render(
      <FoodSupplyForm onSubmit={onSubmit} onCancel={onCancel} />,
    );

    await user.type(screen.getByLabelText("Title"), "Eggs");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

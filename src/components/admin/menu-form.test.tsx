import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { MenuForm, type MenuFormHandle } from "./menu-form";

const categories = [
  { id: "cat-1", name: "Main" },
  { id: "cat-2", name: "Desserts" },
];

describe("MenuForm", () => {
  it("submits valid values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <MenuForm
        categories={categories}
        onSubmit={onSubmit}
        onCancel={() => {}}
        submitLabel="Add Menu"
      />,
    );

    await user.type(screen.getByLabelText("Title"), "Nasi Goreng");
    await user.type(screen.getByLabelText(/Description/), "Spicy fried rice");
    await user.selectOptions(screen.getByLabelText("Category"), "cat-1");
    await user.clear(screen.getByLabelText("Available stock"));
    await user.type(screen.getByLabelText("Available stock"), "10");
    await user.clear(screen.getByLabelText("Sell price (Rp)"));
    await user.type(screen.getByLabelText("Sell price (Rp)"), "25000");
    await user.click(screen.getByRole("button", { name: "Add Menu" }));

    await waitFor(() => {
      expect(onSubmit.mock.calls[0]?.[0]).toEqual({
        title: "Nasi Goreng",
        description: "Spicy fried rice",
        category_id: "cat-1",
        photo_url: "",
        available_stock: 10,
        sell_price: 25000,
        recipe_yield: 1,
        margin_percent: 0,
        vat_percent: 0,
      });
    });
  });

  it("shows validation errors for invalid input", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <MenuForm categories={categories} onSubmit={onSubmit} onCancel={() => {}} />,
    );

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Title is required")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows default food photo preview when photo URL is empty", () => {
    render(
      <MenuForm categories={categories} onSubmit={() => {}} onCancel={() => {}} />,
    );

    const preview = screen.getByAltText("Menu photo preview");
    expect(preview).toHaveAttribute("src", "/default-food.svg");
  });

  it("prefills edit defaults", () => {
    render(
      <MenuForm
        categories={categories}
        defaultValues={{
          title: "Mie Goreng",
          description: "Noodles",
          category_id: "cat-2",
          photo_url: "https://example.com/mie.jpg",
          available_stock: 5,
          sell_price: 30000,
          recipe_yield: 40,
          margin_percent: 30,
          vat_percent: 11,
        }}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByLabelText("Title")).toHaveValue("Mie Goreng");
    expect(screen.getByLabelText(/Description/)).toHaveValue("Noodles");
    expect(screen.getByLabelText("Category")).toHaveValue("cat-2");
    expect(screen.getByLabelText(/Photo URL/)).toHaveValue(
      "https://example.com/mie.jpg",
    );
    expect(screen.getByLabelText("Available stock")).toHaveValue(5);
    expect(screen.getByLabelText("Sell price (Rp)")).toHaveValue(30000);
    expect(screen.getByLabelText("Recipe yield")).toHaveValue(40);
    expect(screen.getByLabelText("Margin %")).toHaveValue(30);
    expect(screen.getByLabelText("VAT %")).toHaveValue(11);
  });

  it("shows default COGS values on create", () => {
    render(
      <MenuForm categories={categories} onSubmit={() => {}} onCancel={() => {}} />,
    );

    expect(screen.getByLabelText("Recipe yield")).toHaveValue(1);
    expect(screen.getByLabelText("Margin %")).toHaveValue(0);
    expect(screen.getByLabelText("VAT %")).toHaveValue(0);
  });

  it("rejects recipe yield of zero", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <MenuForm categories={categories} onSubmit={onSubmit} onCancel={() => {}} />,
    );

    await user.type(screen.getByLabelText("Title"), "Soup");
    await user.selectOptions(screen.getByLabelText("Category"), "cat-1");
    await user.clear(screen.getByLabelText("Available stock"));
    await user.type(screen.getByLabelText("Available stock"), "10");
    await user.clear(screen.getByLabelText("Sell price (Rp)"));
    await user.type(screen.getByLabelText("Sell price (Rp)"), "25000");
    fireEvent.change(screen.getByLabelText("Recipe yield"), {
      target: { value: "0" },
    });
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("Recipe yield must be at least 1"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("applies server COGS field errors via ref", async () => {
    const ref = createRef<MenuFormHandle>();

    render(
      <MenuForm
        ref={ref}
        categories={categories}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );

    ref.current?.applyServerErrors({ recipe_yield: "Yield must be positive" });

    expect(
      await screen.findByText("Yield must be positive"),
    ).toBeInTheDocument();
  });

  it("applies server field errors via ref", async () => {
    const ref = createRef<MenuFormHandle>();

    render(
      <MenuForm
        ref={ref}
        categories={categories}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );

    ref.current?.applyServerErrors({ sell_price: "Price must be positive" });

    expect(
      await screen.findByText("Price must be positive"),
    ).toBeInTheDocument();
  });

  it("calls onCancel without submitting", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onSubmit = vi.fn();

    render(
      <MenuForm
        categories={categories}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );

    await user.type(screen.getByLabelText("Title"), "Satay");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

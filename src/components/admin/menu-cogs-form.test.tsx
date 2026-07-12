import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { MenuCogsForm, type MenuCogsFormHandle } from "./menu-cogs-form";

describe("MenuCogsForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders default COGS values", () => {
    render(<MenuCogsForm onSubmit={() => {}} />);

    expect(screen.getByLabelText("Recipe yield")).toHaveValue(1);
    expect(screen.getByLabelText("Margin %")).toHaveValue(0);
    expect(screen.getByLabelText("VAT %")).toHaveValue(0);
    expect(screen.getByText("COGS configuration")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Number of portions produced by the ingredient quantities below",
      ),
    ).toBeInTheDocument();
  });

  it("prefills custom default values", () => {
    render(
      <MenuCogsForm
        defaultValues={{
          recipe_yield: 40,
          margin_percent: 30,
          vat_percent: 11,
        }}
        onSubmit={() => {}}
      />,
    );

    expect(screen.getByLabelText("Recipe yield")).toHaveValue(40);
    expect(screen.getByLabelText("Margin %")).toHaveValue(30);
    expect(screen.getByLabelText("VAT %")).toHaveValue(11);
  });

  it("rejects recipe yield of zero", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<MenuCogsForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Recipe yield"), {
      target: { value: "0" },
    });
    await user.click(screen.getByRole("button", { name: "Save COGS settings" }));

    expect(
      await screen.findByText("Recipe yield must be at least 1"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits valid COGS values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<MenuCogsForm onSubmit={onSubmit} />);

    await user.clear(screen.getByLabelText("Recipe yield"));
    await user.type(screen.getByLabelText("Recipe yield"), "40");
    await user.clear(screen.getByLabelText("Margin %"));
    await user.type(screen.getByLabelText("Margin %"), "30");
    await user.clear(screen.getByLabelText("VAT %"));
    await user.type(screen.getByLabelText("VAT %"), "11");
    await user.click(screen.getByRole("button", { name: "Save COGS settings" }));

    await waitFor(() => {
      expect(onSubmit.mock.calls[0]?.[0]).toEqual({
        recipe_yield: 40,
        margin_percent: 30,
        vat_percent: 11,
      });
    });
  });

  it("applies server COGS field errors via ref", async () => {
    const ref = createRef<MenuCogsFormHandle>();

    render(<MenuCogsForm ref={ref} onSubmit={() => {}} />);

    ref.current?.applyServerErrors({ recipe_yield: "Yield must be positive" });

    expect(
      await screen.findByText("Yield must be positive"),
    ).toBeInTheDocument();
  });
});

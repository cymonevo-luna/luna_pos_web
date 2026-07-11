import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { CategoryForm, type CategoryFormHandle } from "./category-form";

describe("CategoryForm", () => {
  it("submits valid values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <CategoryForm
        onSubmit={onSubmit}
        onCancel={() => {}}
        submitLabel="Add Category"
      />,
    );

    await user.type(screen.getByLabelText("Name"), "Desserts");
    await user.click(screen.getByRole("button", { name: "Add Category" }));

    await waitFor(() => {
      expect(onSubmit.mock.calls[0]?.[0]).toEqual({ name: "Desserts" });
    });
  });

  it("shows validation errors for invalid input", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<CategoryForm onSubmit={onSubmit} onCancel={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("prefills edit defaults", () => {
    render(
      <CategoryForm
        defaultValues={{ name: "Desserts" }}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByLabelText("Name")).toHaveValue("Desserts");
  });

  it("applies server field errors via ref", async () => {
    const ref = createRef<CategoryFormHandle>();

    render(
      <CategoryForm ref={ref} onSubmit={() => {}} onCancel={() => {}} />,
    );

    ref.current?.applyServerErrors({
      name: "Category name already exists",
    });

    expect(
      await screen.findByText("Category name already exists"),
    ).toBeInTheDocument();
  });

  it("calls onCancel without submitting", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onSubmit = vi.fn();

    render(<CategoryForm onSubmit={onSubmit} onCancel={onCancel} />);

    await user.type(screen.getByLabelText("Name"), "Desserts");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

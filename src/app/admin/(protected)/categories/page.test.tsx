import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminCategoriesPage from "./page";
import { categoriesAdminApi } from "@/lib/api/categories";
import { ApiError } from "@/lib/api/client";
import type { Category } from "@/lib/api/types";
import { toast } from "sonner";

vi.mock("@/lib/api/categories", () => ({
  categoriesAdminApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  categoryFormToPayload: vi.fn((values) => ({
    name: values.name.trim(),
  })),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const category: Category = {
  id: "cat-1",
  name: "Desserts",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-15T00:00:00Z",
};

describe("AdminCategoriesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(categoriesAdminApi.list).mockResolvedValue({
      data: [category],
      meta: { page: 1, per_page: 10, total: 1 },
    });
  });

  it("renders categories from the API", async () => {
    render(<AdminCategoriesPage />);

    expect(await screen.findByText("Desserts")).toBeInTheDocument();
    expect(screen.getByText("1 total")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Category" })).toBeInTheDocument();
  });

  it("shows empty state when no categories match", async () => {
    vi.mocked(categoriesAdminApi.list).mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 10, total: 0 },
    });

    render(<AdminCategoriesPage />);

    expect(await screen.findByText("No categories found.")).toBeInTheDocument();
  });

  it("debounces search and reloads with the search term", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<AdminCategoriesPage />);
    await screen.findByText("Desserts");

    await user.type(screen.getByPlaceholderText("Search by name"), "Dess");
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(categoriesAdminApi.list).toHaveBeenLastCalledWith({
        page: 1,
        perPage: 10,
        search: "Dess",
      });
    });

    vi.useRealTimers();
  });

  it("deletes a category after confirmation", async () => {
    const user = userEvent.setup();
    vi.mocked(categoriesAdminApi.delete).mockResolvedValue({
      data: undefined,
    });

    render(<AdminCategoriesPage />);
    await screen.findByText("Desserts");

    await user.click(screen.getByLabelText("Delete category"));
    expect(screen.getByText("Delete category")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(categoriesAdminApi.delete).toHaveBeenCalledWith("cat-1");
    });
    expect(toast.success).toHaveBeenCalledWith("Category deleted");
  });

  it("shows error when deleting a category in use", async () => {
    const user = userEvent.setup();
    vi.mocked(categoriesAdminApi.delete).mockRejectedValue(
      new ApiError(
        409,
        "conflict",
        "Cannot delete category that has menu items",
      ),
    );

    render(<AdminCategoriesPage />);
    await screen.findByText("Desserts");

    await user.click(screen.getByLabelText("Delete category"));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Cannot delete category that has menu items",
      );
    });
    expect(screen.getByRole("cell", { name: "Desserts" })).toBeInTheDocument();
    expect(categoriesAdminApi.delete).toHaveBeenCalledWith("cat-1");
  });

  it("creates a category from the dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(categoriesAdminApi.create).mockResolvedValue({
      data: {
        ...category,
        id: "cat-2",
        name: "Appetizers",
      },
    });

    render(<AdminCategoriesPage />);
    await screen.findByText("Desserts");

    await user.click(screen.getByRole("button", { name: "Add Category" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("Name"), "Appetizers");
    await user.click(
      within(dialog).getByRole("button", { name: "Add Category" }),
    );

    await waitFor(() => {
      expect(categoriesAdminApi.create).toHaveBeenCalledWith({
        name: "Appetizers",
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Category created");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("edits a category from the dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(categoriesAdminApi.update).mockResolvedValue({
      data: {
        ...category,
        name: "Dessert",
      },
    });

    render(<AdminCategoriesPage />);
    await screen.findByText("Desserts");

    await user.click(screen.getByLabelText("Edit category"));
    expect(screen.getByText("Edit category")).toBeInTheDocument();

    const nameInput = screen.getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Dessert");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(categoriesAdminApi.update).toHaveBeenCalledWith("cat-1", {
        name: "Dessert",
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Category updated");
  });

  it("maps duplicate name conflict onto the name field", async () => {
    const user = userEvent.setup();
    vi.mocked(categoriesAdminApi.create).mockRejectedValue(
      new ApiError(409, "conflict", "Category name already exists"),
    );

    render(<AdminCategoriesPage />);
    await screen.findByText("Desserts");

    await user.click(screen.getByRole("button", { name: "Add Category" }));
    const dialog = screen.getByRole("dialog");

    await user.type(within(dialog).getByLabelText("Name"), "Desserts");
    await user.click(
      within(dialog).getByRole("button", { name: "Add Category" }),
    );

    expect(
      await screen.findByText("Category name already exists"),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes the dialog on cancel without saving", async () => {
    const user = userEvent.setup();

    render(<AdminCategoriesPage />);
    await screen.findByText("Desserts");

    await user.click(screen.getByRole("button", { name: "Add Category" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Name"), "Appetizers");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(categoriesAdminApi.create).not.toHaveBeenCalled();
  });
});

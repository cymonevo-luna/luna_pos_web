import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { MenuForm, type MenuFormHandle } from "./menu-form";
import { uploadMenuPhoto, MENU_PHOTO_MAX_BYTES } from "@/lib/api/uploads";
import { ApiError } from "@/lib/api/client";

vi.mock("@/lib/api/uploads", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/uploads")>();
  return {
    ...actual,
    uploadMenuPhoto: vi.fn(),
  };
});

const categories = [
  { id: "cat-1", name: "Main" },
  { id: "cat-2", name: "Desserts" },
];

describe("MenuForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders basic menu fields only", () => {
    render(
      <MenuForm categories={categories} onSubmit={() => {}} onCancel={() => {}} />,
    );

    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
    expect(screen.getByLabelText("Category")).toBeInTheDocument();
    expect(screen.getByLabelText("Menu photo")).toBeInTheDocument();
    expect(screen.getByLabelText("Available stock")).toBeInTheDocument();
    expect(screen.getByLabelText("Sell price (Rp)")).toBeInTheDocument();
    expect(screen.queryByLabelText("Recipe yield")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Margin %")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("VAT %")).not.toBeInTheDocument();
    expect(screen.queryByText("COGS configuration")).not.toBeInTheDocument();
  });

  it("renders a file chooser for menu photos", () => {
    render(
      <MenuForm categories={categories} onSubmit={() => {}} onCancel={() => {}} />,
    );

    const fileInput = screen.getByLabelText("Menu photo");
    expect(fileInput).toHaveAttribute("type", "file");
    expect(fileInput).toHaveAttribute(
      "accept",
      "image/jpeg,image/png,image/webp",
    );
    expect(screen.getByRole("button", { name: "Choose image" })).toBeInTheDocument();
  });

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

  it("uploads a valid file and updates the preview", async () => {
    const uploadedUrl = "http://localhost:8087/static/uploads/menus/test.webp";
    vi.mocked(uploadMenuPhoto).mockResolvedValue({
      url: uploadedUrl,
      filename: "test.webp",
      size_bytes: 1024,
    });

    render(
      <MenuForm categories={categories} onSubmit={() => {}} onCancel={() => {}} />,
    );

    const file = new File([new Uint8Array(1024)], "test.webp", {
      type: "image/webp",
    });
    const fileInput = screen.getByLabelText("Menu photo");

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(uploadMenuPhoto).toHaveBeenCalledTimes(1);
      expect(uploadMenuPhoto).toHaveBeenCalledWith(file);
    });

    expect(screen.getByLabelText(/Photo URL/)).toHaveValue(uploadedUrl);
    expect(screen.getByAltText("Menu photo preview")).toHaveAttribute(
      "src",
      uploadedUrl,
    );
  });

  it("shows a client-side error for invalid file types without uploading", async () => {
    render(
      <MenuForm categories={categories} onSubmit={() => {}} onCancel={() => {}} />,
    );

    const file = new File(["not-an-image"], "notes.txt", {
      type: "text/plain",
    });
    fireEvent.change(screen.getByLabelText("Menu photo"), {
      target: { files: [file] },
    });

    expect(
      await screen.findByText("File must be a JPEG, PNG, or WebP image"),
    ).toBeInTheDocument();
    expect(uploadMenuPhoto).not.toHaveBeenCalled();
  });

  it("shows a client-side error for oversize files without uploading", async () => {
    render(
      <MenuForm categories={categories} onSubmit={() => {}} onCancel={() => {}} />,
    );

    const file = new File(
      [new Uint8Array(MENU_PHOTO_MAX_BYTES + 1)],
      "large.jpg",
      { type: "image/jpeg" },
    );
    fireEvent.change(screen.getByLabelText("Menu photo"), {
      target: { files: [file] },
    });

    expect(
      await screen.findByText("Image must be 5 MB or smaller"),
    ).toBeInTheDocument();
    expect(uploadMenuPhoto).not.toHaveBeenCalled();
  });

  it("shows upload API errors inline", async () => {
    vi.mocked(uploadMenuPhoto).mockRejectedValue(
      new ApiError(422, "invalid_file", "Unsupported image"),
    );

    render(
      <MenuForm categories={categories} onSubmit={() => {}} onCancel={() => {}} />,
    );

    const file = new File([new Uint8Array(1024)], "test.webp", {
      type: "image/webp",
    });
    fireEvent.change(screen.getByLabelText("Menu photo"), {
      target: { files: [file] },
    });

    expect(
      await screen.findByText("Unsupported image"),
    ).toBeInTheDocument();
  });

  it("clears photo_url when Remove image is clicked", async () => {
    const user = userEvent.setup();

    render(
      <MenuForm
        categories={categories}
        defaultValues={{ photo_url: "https://example.com/food.jpg" }}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByAltText("Menu photo preview")).toHaveAttribute(
      "src",
      "https://example.com/food.jpg",
    );

    await user.click(screen.getByRole("button", { name: "Remove image" }));

    expect(screen.getByLabelText(/Photo URL/)).toHaveValue("");
    expect(screen.getByAltText("Menu photo preview")).toHaveAttribute(
      "src",
      "/default-food.svg",
    );
  });

  it("submits a manually entered photo URL without uploading", async () => {
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
    await user.selectOptions(screen.getByLabelText("Category"), "cat-1");
    await user.clear(screen.getByLabelText("Available stock"));
    await user.type(screen.getByLabelText("Available stock"), "10");
    await user.clear(screen.getByLabelText("Sell price (Rp)"));
    await user.type(screen.getByLabelText("Sell price (Rp)"), "25000");
    await user.type(
      screen.getByLabelText(/Photo URL/),
      "https://example.com/food.jpg",
    );
    await user.click(screen.getByRole("button", { name: "Add Menu" }));

    await waitFor(() => {
      expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
        photo_url: "https://example.com/food.jpg",
      });
    });
    expect(uploadMenuPhoto).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminBranchAssetsPage from "./page";
import { branchAssetsAdminApi } from "@/lib/api/branch-assets";
import { uploadBranchAssetPhoto } from "@/lib/api/uploads";
import { ApiError } from "@/lib/api/client";
import type { BranchAsset } from "@/lib/api/types";
import { formatRupiah } from "@/lib/utils";
import { toast } from "sonner";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/admin/branch-assets"),
}));

vi.mock("@/lib/api/branch-assets", () => ({
  branchAssetsAdminApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  branchAssetFormToPayload: vi.fn((values) => ({
    title: values.title.trim(),
    quantity: String(values.quantity),
    price_amount: values.price_amount,
    photo_url: values.photo_url?.trim() ?? "",
    ...(values.description?.trim()
      ? { description: values.description.trim() }
      : {}),
  })),
}));

vi.mock("@/lib/api/uploads", () => ({
  uploadBranchAssetPhoto: vi.fn(),
  validateMenuPhotoFile: vi.fn(() => null),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const asset: BranchAsset = {
  id: "ba-1",
  title: "Espresso machine",
  description: "Commercial grade",
  photo_url: null,
  quantity: 2,
  price_amount: 15_000_000,
  line_value: 30_000_000,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-15T00:00:00Z",
};

describe("AdminBranchAssetsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(branchAssetsAdminApi.list).mockResolvedValue({
      data: [asset],
      meta: { page: 1, per_page: 10, total: 1 },
    });
  });

  it("renders assets from the API with formatted currency", async () => {
    render(<AdminBranchAssetsPage />);

    expect(await screen.findByText("Espresso machine")).toBeInTheDocument();
    expect(screen.getByText("Commercial grade")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getAllByText(formatRupiah(15_000_000)).length).toBeGreaterThan(0);
    expect(screen.getByText(formatRupiah(30_000_000))).toBeInTheDocument();
    expect(screen.getByText("1 total")).toBeInTheDocument();
  });

  it("shows empty state when no assets match", async () => {
    vi.mocked(branchAssetsAdminApi.list).mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 10, total: 0 },
    });

    render(<AdminBranchAssetsPage />);

    expect(
      await screen.findByText("No branch assets found."),
    ).toBeInTheDocument();
  });

  it("debounces search and reloads with the search term", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<AdminBranchAssetsPage />);
    await screen.findByText("Espresso machine");

    await user.type(screen.getByPlaceholderText("Search by title"), "espresso");
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(branchAssetsAdminApi.list).toHaveBeenLastCalledWith({
        page: 1,
        perPage: 10,
        search: "espresso",
      });
    });

    vi.useRealTimers();
  });

  it("deletes an asset after confirmation", async () => {
    const user = userEvent.setup();
    vi.mocked(branchAssetsAdminApi.delete).mockResolvedValue({
      data: undefined,
    });

    render(<AdminBranchAssetsPage />);
    await screen.findByText("Espresso machine");

    await user.click(screen.getByLabelText("Delete branch asset"));
    expect(screen.getByText("Delete branch asset")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(branchAssetsAdminApi.delete).toHaveBeenCalledWith("ba-1");
    });
  });

  it("creates an asset from the dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(branchAssetsAdminApi.create).mockResolvedValue({
      data: {
        ...asset,
        id: "ba-2",
        title: "Dining table",
        quantity: 4,
        price_amount: 2_500_000,
        line_value: 10_000_000,
      },
    });

    render(<AdminBranchAssetsPage />);
    await screen.findByText("Espresso machine");

    await user.click(screen.getAllByRole("button", { name: "Add asset" })[0]);
    const dialog = screen.getByRole("dialog");

    await user.type(within(dialog).getByLabelText("Title"), "Dining table");
    await user.clear(within(dialog).getByLabelText("Quantity"));
    await user.type(within(dialog).getByLabelText("Quantity"), "4");
    await user.clear(within(dialog).getByLabelText("Price (Rp)"));
    await user.type(within(dialog).getByLabelText("Price (Rp)"), "2500000");
    await user.click(
      within(dialog).getByRole("button", { name: "Add asset" }),
    );

    await waitFor(() => {
      expect(branchAssetsAdminApi.create).toHaveBeenCalledWith({
        title: "Dining Table",
        quantity: "4",
        price_amount: 2_500_000,
        photo_url: "",
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Branch asset created");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("uploads a photo on create and includes photo_url in payload", async () => {
    const user = userEvent.setup();
    vi.mocked(uploadBranchAssetPhoto).mockResolvedValue({
      url: "https://cdn.example.com/asset.jpg",
      filename: "asset.jpg",
      size_bytes: 1024,
    });
    vi.mocked(branchAssetsAdminApi.create).mockResolvedValue({
      data: {
        ...asset,
        photo_url: "https://cdn.example.com/asset.jpg",
      },
    });

    render(<AdminBranchAssetsPage />);
    await screen.findByText("Espresso machine");

    await user.click(screen.getAllByRole("button", { name: "Add asset" })[0]);
    const dialog = screen.getByRole("dialog");

    await user.type(within(dialog).getByLabelText("Title"), "Chair");
    await user.clear(within(dialog).getByLabelText("Quantity"));
    await user.type(within(dialog).getByLabelText("Quantity"), "10");
    await user.clear(within(dialog).getByLabelText("Price (Rp)"));
    await user.type(within(dialog).getByLabelText("Price (Rp)"), "150000");

    const file = new File(["img"], "chair.jpg", { type: "image/jpeg" });
    const fileInput = within(dialog).getByLabelText(/Photo/);
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(uploadBranchAssetPhoto).toHaveBeenCalledWith(file);
    });

    await user.click(
      within(dialog).getByRole("button", { name: "Add asset" }),
    );

    await waitFor(() => {
      expect(branchAssetsAdminApi.create).toHaveBeenCalledWith({
        title: "Chair",
        quantity: "10",
        price_amount: 150_000,
        photo_url: "https://cdn.example.com/asset.jpg",
      });
    });
  });

  it("edits an asset from the dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(branchAssetsAdminApi.update).mockResolvedValue({
      data: {
        ...asset,
        quantity: 3,
        line_value: 45_000_000,
      },
    });

    render(<AdminBranchAssetsPage />);
    await screen.findByText("Espresso machine");

    await user.click(screen.getByLabelText("Edit branch asset"));
    expect(screen.getByText("Edit branch asset")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Quantity"));
    await user.type(screen.getByLabelText("Quantity"), "3");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(branchAssetsAdminApi.update).toHaveBeenCalledWith("ba-1", {
        title: "Espresso machine",
        description: "Commercial grade",
        quantity: "3",
        price_amount: 15_000_000,
        photo_url: "",
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Branch asset updated");
  });

  it("maps server validation errors onto form fields", async () => {
    const user = userEvent.setup();
    vi.mocked(branchAssetsAdminApi.create).mockRejectedValue(
      new ApiError(422, "validation_error", "Validation failed", {
        quantity: "Quantity must be non-negative",
      }),
    );

    render(<AdminBranchAssetsPage />);
    await screen.findByText("Espresso machine");

    await user.click(screen.getAllByRole("button", { name: "Add asset" })[0]);
    const dialog = screen.getByRole("dialog");

    await user.type(within(dialog).getByLabelText("Title"), "Chair");
    await user.clear(within(dialog).getByLabelText("Quantity"));
    await user.type(within(dialog).getByLabelText("Quantity"), "1");
    await user.clear(within(dialog).getByLabelText("Price (Rp)"));
    await user.type(within(dialog).getByLabelText("Price (Rp)"), "1000");
    await user.click(
      within(dialog).getByRole("button", { name: "Add asset" }),
    );

    expect(
      await screen.findByText("Quantity must be non-negative"),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

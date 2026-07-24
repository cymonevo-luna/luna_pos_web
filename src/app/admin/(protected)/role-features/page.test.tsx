import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminRoleFeaturesPage from "./page";
import {
  getRoleFeatures,
  listFeatures,
  updateRoleFeatures,
} from "@/lib/api/role-features";
import { ApiError } from "@/lib/api/client";
import { toast } from "sonner";

vi.mock("@/lib/api/role-features", () => ({
  listFeatures: vi.fn(),
  getRoleFeatures: vi.fn(),
  updateRoleFeatures: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const sampleFeatures = [
  {
    key: "cogs",
    name: "COGS",
    description: "View and manage cost of goods sold",
    category: "admin" as const,
    sort_order: 10,
  },
  {
    key: "users.manage",
    name: "User management",
    category: "admin" as const,
    sort_order: 20,
  },
  {
    key: "role_features.manage",
    name: "Privilege mapping",
    category: "admin" as const,
    sort_order: 30,
  },
  {
    key: "pos.checkout",
    name: "POS Checkout",
    category: "pos" as const,
    sort_order: 40,
  },
  {
    key: "registry.synced",
    name: "Registry Synced Feature",
    category: "admin" as const,
    sort_order: 50,
  },
];

const sampleMappings = [
  {
    role: "admin" as const,
    features: ["cogs", "users.manage", "role_features.manage"],
  },
  { role: "manager" as const, features: ["cogs"] },
  { role: "cashier" as const, features: ["pos.checkout"] },
  { role: "operational" as const, features: [] },
  { role: "cook" as const, features: [] },
];

describe("AdminRoleFeaturesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listFeatures).mockResolvedValue({ data: sampleFeatures });
    vi.mocked(getRoleFeatures).mockResolvedValue({ data: sampleMappings });
  });

  it("renders features grouped by category", async () => {
    render(<AdminRoleFeaturesPage />);

    expect(await screen.findByText("Admin dashboard")).toBeInTheDocument();
    expect(screen.getByText("POS mobile app")).toBeInTheDocument();
    expect(screen.getByText("COGS")).toBeInTheDocument();
    expect(screen.getByText("POS Checkout")).toBeInTheDocument();
    expect(screen.getByText("registry.synced")).toBeInTheDocument();
  });

  describe("Cook", () => {
    it("renders Cook column alongside other role columns", async () => {
      render(<AdminRoleFeaturesPage />);

      expect(await screen.findByText("Admin")).toBeInTheDocument();
      expect(screen.getByText("Manager")).toBeInTheDocument();
      expect(screen.getByText("Cashier")).toBeInTheDocument();
      expect(screen.getByText("Operational")).toBeInTheDocument();
      expect(screen.getByText("Cook")).toBeInTheDocument();
    });

    it("treats null cook features from the API as an empty selection", async () => {
      vi.mocked(getRoleFeatures).mockResolvedValue({
        data: [
          ...sampleMappings.filter((mapping) => mapping.role !== "cook"),
          { role: "cook", features: null },
        ],
      });

      render(<AdminRoleFeaturesPage />);
      await screen.findByText("COGS");

      const cookCogsCheckbox = screen.getByRole("checkbox", {
        name: "COGS for Cook",
      });
      expect(cookCogsCheckbox).not.toBeChecked();
    });

    it("saves updated cook features and shows success feedback", async () => {
      const user = userEvent.setup();
      vi.mocked(updateRoleFeatures).mockResolvedValue({
        data: { role: "cook", features: ["cogs"] },
      });

      render(<AdminRoleFeaturesPage />);
      await screen.findByText("COGS");

      const cookCogsCheckbox = screen.getByRole("checkbox", {
        name: "COGS for Cook",
      });
      expect(cookCogsCheckbox).not.toBeChecked();
      await user.click(cookCogsCheckbox);
      expect(cookCogsCheckbox).toBeChecked();

      const saveButtons = screen.getAllByRole("button", { name: "Save" });
      await user.click(saveButtons[4]);

      await waitFor(() => {
        expect(updateRoleFeatures).toHaveBeenCalledWith("cook", ["cogs"]);
        expect(toast.success).toHaveBeenCalledWith("Cook privileges saved");
      });
    });
  });

  it("saves updated manager features and shows success feedback", async () => {
    const user = userEvent.setup();
    vi.mocked(updateRoleFeatures).mockResolvedValue({
      data: { role: "manager", features: [] },
    });

    render(<AdminRoleFeaturesPage />);
    await screen.findByText("COGS");

    const managerCogsCheckbox = screen.getByRole("checkbox", {
      name: "COGS for Manager",
    });
    expect(managerCogsCheckbox).toBeChecked();
    await user.click(managerCogsCheckbox);
    expect(managerCogsCheckbox).not.toBeChecked();

    const saveButtons = screen.getAllByRole("button", { name: "Save" });
    await user.click(saveButtons[1]);

    await waitFor(() => {
      expect(updateRoleFeatures).toHaveBeenCalledWith("manager", []);
      expect(toast.success).toHaveBeenCalledWith("Manager privileges saved");
    });
  });

  it("shows API validation errors and keeps unsaved checkbox state", async () => {
    const user = userEvent.setup();
    vi.mocked(updateRoleFeatures).mockRejectedValue(
      new ApiError(
        409,
        "conflict",
        "Cannot remove role_features.manage from your own admin role",
      ),
    );

    render(<AdminRoleFeaturesPage />);
    await screen.findByText("Privilege mapping");

    const adminPrivilegeCheckbox = screen.getByRole("checkbox", {
      name: "Privilege mapping for Admin",
    });
    expect(adminPrivilegeCheckbox).toBeChecked();
    await user.click(adminPrivilegeCheckbox);
    expect(adminPrivilegeCheckbox).not.toBeChecked();

    const saveButtons = screen.getAllByRole("button", { name: "Save" });
    await user.click(saveButtons[0]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Cannot remove role_features.manage from your own admin role",
      );
      expect(adminPrivilegeCheckbox).toBeChecked();
    });
  });

  it("renders newly registered features from the API without code changes", async () => {
    render(<AdminRoleFeaturesPage />);

    expect(
      await screen.findByText("Registry Synced Feature"),
    ).toBeInTheDocument();
  });
});

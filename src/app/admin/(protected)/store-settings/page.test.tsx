import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import userEvent from "@testing-library/user-event";
import AdminStoreSettingsPage from "./page";
import {
  getAdminStoreSettings,
  updateAdminStoreSettings,
} from "@/lib/api/store-settings";
import { toast } from "sonner";

vi.mock("@/lib/api/store-settings", () => ({
  getAdminStoreSettings: vi.fn(),
  updateAdminStoreSettings: vi.fn(),
  storeSettingsFormToPayload: (values: {
    brand_name: string;
    branch_name: string;
    address: string;
    phone: string;
    thank_you_note?: string;
  }) => ({
    brand_name: values.brand_name.trim(),
    branch_name: values.branch_name.trim(),
    address: values.address.trim(),
    phone: values.phone.trim(),
    thank_you_note: values.thank_you_note?.trim() ?? "",
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const initialSettings = {
  brand_name: "Luna Cafe",
  branch_name: "Downtown",
  address: "123 Main St",
  phone: "+62 812 3456 7890",
  thank_you_note: "Thank you for visiting!",
};

describe("AdminStoreSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminStoreSettings).mockResolvedValue({
      data: initialSettings,
    });
  });

  it("loads receipt settings from the API", async () => {
    renderWithProviders(<AdminStoreSettingsPage />);

    expect(await screen.findByDisplayValue("Luna Cafe")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Downtown")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Thank you for visiting!")).toBeInTheDocument();
    expect(getAdminStoreSettings).toHaveBeenCalled();
  });

  it("saves an updated thank-you note and reloads persisted values", async () => {
    const user = userEvent.setup();
    const updatedSettings = {
      ...initialSettings,
      thank_you_note: "See you again soon!",
    };

    vi.mocked(updateAdminStoreSettings).mockResolvedValue({
      data: updatedSettings,
    });

    renderWithProviders(<AdminStoreSettingsPage />);
    await screen.findByDisplayValue("Thank you for visiting!");

    const noteField = screen.getByLabelText(/Thank you note/i);
    await user.clear(noteField);
    await user.type(noteField, "See you again soon!");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateAdminStoreSettings).toHaveBeenCalledWith({
        brand_name: "Luna Cafe",
        branch_name: "Downtown",
        address: "123 Main St",
        phone: "+62 812 3456 7890",
        thank_you_note: "See you again soon!",
      });
      expect(toast.success).toHaveBeenCalledWith("Receipt settings saved");
    });

    expect(screen.getByDisplayValue("See you again soon!")).toBeInTheDocument();
  });
});

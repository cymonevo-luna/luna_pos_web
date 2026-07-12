import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminUserRolesForm } from "./user-roles-form";
import type { User } from "@/lib/api/types";

const adminUser: User = {
  id: "admin-1",
  email: "admin@example.com",
  name: "Only Admin",
  roles: ["admin"],
  merchant_id: "merchant-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-15T00:00:00Z",
};

const cashierUser: User = {
  id: "cashier-1",
  email: "cashier@example.com",
  name: "Cashier User",
  roles: ["cashier"],
  merchant_id: "merchant-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-15T00:00:00Z",
};

describe("AdminUserRolesForm", () => {
  it("submits updated roles", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <AdminUserRolesForm
        user={cashierUser}
        allUsers={[adminUser, cashierUser]}
        defaultValues={{ roles: ["cashier"] }}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />,
    );

    await user.click(screen.getByLabelText("Manager"));
    await user.click(screen.getByRole("button", { name: "Save roles" }));

    await waitFor(() => {
      expect(onSubmit.mock.calls[0]?.[0]).toEqual({
        roles: ["cashier", "manager"],
      });
    });
  });

  it("shows a warning when removing the last admin role", async () => {
    const user = userEvent.setup();

    render(
      <AdminUserRolesForm
        user={adminUser}
        allUsers={[adminUser]}
        defaultValues={{ roles: ["admin"] }}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );

    await user.click(screen.getByLabelText("Admin"));

    expect(
      screen.getByText(/without an administrator/i),
    ).toBeInTheDocument();
  });
});

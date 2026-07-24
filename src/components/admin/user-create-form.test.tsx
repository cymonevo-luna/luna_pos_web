import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import {
  AdminUserCreateForm,
  type AdminUserCreateFormHandle,
} from "./user-create-form";

describe("AdminUserCreateForm", () => {
  it("shows Cook as an assignable role checkbox", () => {
    render(<AdminUserCreateForm onSubmit={() => {}} onCancel={() => {}} />);

    expect(screen.getByLabelText("Cook")).toBeInTheDocument();
  });

  it("submits cook role when Cook checkbox is selected", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <AdminUserCreateForm
        onSubmit={onSubmit}
        onCancel={() => {}}
        submitLabel="Create user"
      />,
    );

    await user.type(screen.getByLabelText("Email"), "cook@example.com");
    await user.type(screen.getByLabelText("Name"), "Cook User");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByLabelText("Cook"));
    await user.click(screen.getByRole("button", { name: "Create user" }));

    await waitFor(() => {
      expect(onSubmit.mock.calls[0]?.[0]).toEqual({
        email: "cook@example.com",
        name: "Cook User",
        password: "password123",
        roles: ["cook"],
      });
    });
  });

  it("submits valid values with selected roles", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <AdminUserCreateForm
        onSubmit={onSubmit}
        onCancel={() => {}}
        submitLabel="Create user"
      />,
    );

    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Name"), "New User");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByLabelText("Cashier"));
    await user.click(screen.getByLabelText("Operational"));
    await user.click(screen.getByRole("button", { name: "Create user" }));

    await waitFor(() => {
      expect(onSubmit.mock.calls[0]?.[0]).toEqual({
        email: "new@example.com",
        name: "New User",
        password: "password123",
        roles: ["cashier", "operational"],
      });
    });
  });

  it("requires at least one role", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<AdminUserCreateForm onSubmit={onSubmit} onCancel={() => {}} />);

    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Name"), "New User");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Create user" }));

    expect(
      await screen.findByText("Select at least one role"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("applies server field errors via ref", async () => {
    const ref = createRef<AdminUserCreateFormHandle>();

    render(
      <AdminUserCreateForm ref={ref} onSubmit={() => {}} onCancel={() => {}} />,
    );

    ref.current?.applyServerErrors({
      email: "Email already exists",
    });

    expect(await screen.findByText("Email already exists")).toBeInTheDocument();
  });
});

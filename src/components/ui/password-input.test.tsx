import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PasswordInput } from "./password-input";

describe("PasswordInput", () => {
  it("toggles visibility when the button is clicked", async () => {
    render(<PasswordInput aria-label="password" defaultValue="secret" />);
    const input = screen.getByLabelText("password") as HTMLInputElement;
    expect(input.type).toBe("password");

    await userEvent.click(screen.getByRole("button", { name: /show password/i }));
    expect(input.type).toBe("text");

    await userEvent.click(screen.getByRole("button", { name: /hide password/i }));
    expect(input.type).toBe("password");
  });
});

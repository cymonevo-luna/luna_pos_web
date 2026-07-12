import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { CtaSection } from "./cta-section";

describe("CtaSection", () => {
  it("links to merchant registration with account creation copy", () => {
    render(<CtaSection />);

    const registerLink = screen.getByRole("link", {
      name: "Create merchant account",
    });
    expect(registerLink).toHaveAttribute("href", "/register");
    expect(
      screen.getByText(/merchant registration is free/i),
    ).toBeInTheDocument();
  });

  it("links to the admin sign-in page", () => {
    render(<CtaSection />);

    expect(
      screen.getByRole("link", { name: "Admin sign in" }),
    ).toHaveAttribute("href", "/admin/login");
  });

  it("keeps readable contrast classes in dark mode", () => {
    const { container } = render(
      <div className="dark">
        <CtaSection />
      </div>,
    );

    const section = container.querySelector("section");
    expect(section).not.toBeNull();
    expect(section).toHaveClass("bg-primary", "text-primary-foreground");

    const heading = screen.getByRole("heading", {
      name: /ready to modernize your point of sale/i,
    });
    expect(heading).toHaveClass("text-3xl", "font-bold");

    const supportingText = screen.getByText(/merchant registration is free/i);
    expect(supportingText).toHaveClass("text-primary-foreground/90");

    const adminLink = screen.getByRole("link", { name: "Admin sign in" });
    expect(adminLink.className).toMatch(/text-primary-foreground/);

    const registerLink = screen.getByRole("link", {
      name: "Create merchant account",
    });
    expect(within(section!).getByRole("link", { name: "Create merchant account" })).toBe(
      registerLink,
    );
  });
});

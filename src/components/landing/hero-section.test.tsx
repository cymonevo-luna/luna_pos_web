import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeroSection } from "./hero-section";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("HeroSection", () => {
  it("renders headline with Luna POS product language", () => {
    render(<HeroSection />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /run your store from menu to receipt/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/starter for your next full-stack product/i),
    ).not.toBeInTheDocument();
  });

  it("links primary and secondary CTAs with accessible names", () => {
    render(<HeroSection />);

    expect(
      screen.getByRole("link", { name: /get started free/i }),
    ).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("stacks hero content vertically on narrow viewports", () => {
    const { container } = render(<HeroSection />);

    const ctaGroup = container.querySelector(".flex.flex-col");
    expect(ctaGroup).toBeInTheDocument();
    expect(ctaGroup).toHaveClass("items-stretch");
    expect(container.querySelector("section")).toHaveClass("overflow-hidden");
  });
});

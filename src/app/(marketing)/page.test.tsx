import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "./page";

const { mockConfig } = vi.hoisted(() => ({
  mockConfig: {
    posAppDownloadUrl: "",
  },
}));

vi.mock("@/lib/config", () => ({
  config: mockConfig,
}));

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

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    onError,
  }: {
    src: string;
    alt: string;
    onError?: () => void;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={onError}
      data-testid="pos-app-mockup-image"
    />
  ),
}));

describe("HomePage", () => {
  beforeEach(() => {
    mockConfig.posAppDownloadUrl = "";
  });

  it("renders Luna POS hero headline, not template starter copy", () => {
    render(<HomePage />);

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

  it("renders features section with id features", () => {
    const { container } = render(<HomePage />);

    expect(container.querySelector("#features")).toBeInTheDocument();
  });

  it("renders POS app section with id pos-app", () => {
    render(<HomePage />);

    expect(document.getElementById("pos-app")).toBeInTheDocument();
  });

  it("includes register CTA link to /register", () => {
    render(<HomePage />);

    const registerLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href") === "/register");
    expect(registerLinks.length).toBeGreaterThan(0);
  });

  it("includes admin login link to /admin/login", () => {
    render(<HomePage />);

    const adminLoginLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href") === "/admin/login");
    expect(adminLoginLinks.length).toBeGreaterThan(0);
  });
});

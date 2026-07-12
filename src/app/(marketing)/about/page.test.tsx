import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AboutPage from "./page";

describe("AboutPage", () => {
  it("does not show template starter content", () => {
    render(<AboutPage />);

    expect(
      screen.queryByText(/about this template/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/tech stack/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/react-hook-form/i)).not.toBeInTheDocument();
  });

  it("describes Luna POS components in plain language", () => {
    render(<AboutPage />);

    expect(
      screen.getByRole("heading", { name: /about luna pos/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/web admin/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/mobile cashier app/i).length).toBeGreaterThan(
      0,
    );
  });

  it("links to merchant registration and marketing pages", () => {
    render(<AboutPage />);

    expect(
      screen.getByRole("link", { name: /register your merchant/i }),
    ).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: /back to home/i })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: /view features/i })).toHaveAttribute(
      "href",
      "/#features",
    );
  });
});

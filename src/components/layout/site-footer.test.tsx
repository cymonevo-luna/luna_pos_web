import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteFooter } from "./site-footer";

describe("SiteFooter", () => {
  it("renders marketing navigation links", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("link", { name: "Features" })).toHaveAttribute(
      "href",
      "/#features",
    );
    expect(screen.getByRole("link", { name: "POS App" })).toHaveAttribute(
      "href",
      "/#pos-app",
    );
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute(
      "href",
      "/about",
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByRole("link", { name: "Register" })).toHaveAttribute(
      "href",
      "/register",
    );
  });
});

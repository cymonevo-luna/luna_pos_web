import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { FeaturesSection } from "./features-section";

describe("FeaturesSection", () => {
  it("renders a section with id features", () => {
    const { container } = render(<FeaturesSection />);
    expect(container.querySelector("#features")).toBeInTheDocument();
  });

  it("renders six feature cards with Luna POS-specific copy", () => {
    render(<FeaturesSection />);

    const section = screen.getByRole("heading", {
      name: /Everything you need to run your business/i,
    }).closest("section");
    expect(section).not.toBeNull();

    const titles = within(section!).getAllByRole("heading", { level: 3 });
    expect(titles).toHaveLength(6);
    expect(titles.map((el) => el.textContent)).toEqual([
      "Menu & categories",
      "Inventory & suppliers",
      "COGS & margins",
      "Transactions & reporting",
      "Multi-role access",
      "Store settings",
    ]);

    expect(screen.queryByText(/JWT Authentication/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tested foundation/i)).not.toBeInTheDocument();
  });

  it("links the admin console CTA to /admin/login", () => {
    render(<FeaturesSection />);

    const adminLink = screen.getByRole("link", { name: /Open admin console/i });
    expect(adminLink).toHaveAttribute("href", "/admin/login");
  });
});

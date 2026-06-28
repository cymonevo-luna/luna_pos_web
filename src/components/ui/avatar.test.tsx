import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Avatar } from "./avatar";

describe("Avatar", () => {
  it("shows initials when no image is provided", () => {
    render(<Avatar name="Alex Johnson" />);
    expect(screen.getByText("AJ")).toBeInTheDocument();
  });

  it("renders an image when src is provided", () => {
    render(<Avatar name="Alex Johnson" src="https://example.com/a.png" />);
    expect(screen.getByRole("img", { name: "Alex Johnson" })).toBeInTheDocument();
  });
});

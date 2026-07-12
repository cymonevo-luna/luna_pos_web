import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Logo } from "./logo";
import { config } from "@/lib/config";

describe("Logo", () => {
  it("renders the configured app name", () => {
    render(<Logo />);
    expect(screen.getByText(config.appName)).toBeInTheDocument();
  });

  it("hides text when showText is false", () => {
    render(<Logo showText={false} />);
    expect(screen.queryByText(config.appName)).not.toBeInTheDocument();
  });
});

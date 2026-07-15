import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Logo } from "./logo";
import { config } from "@/lib/config";

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    width,
    height,
    className,
    "aria-hidden": ariaHidden,
  }: {
    src: string;
    alt: string;
    width: number;
    height: number;
    className?: string;
    "aria-hidden"?: boolean;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      aria-hidden={ariaHidden}
    />
  ),
}));

describe("Logo", () => {
  it("renders the configured app name", () => {
    render(<Logo />);
    expect(screen.getByText(config.appName)).toBeInTheDocument();
  });

  it("hides text when showText is false", () => {
    render(<Logo showText={false} />);
    expect(screen.queryByText(config.appName)).not.toBeInTheDocument();
  });

  it("renders the brand logo image", () => {
    render(<Logo />);
    const image = screen.getByRole("presentation", { hidden: true });
    expect(image).toHaveAttribute("src", "/brand/logo.png");
    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveAttribute("aria-hidden", "true");
  });

  it("uses app name as alt text when showText is false", () => {
    render(<Logo showText={false} />);
    const image = screen.getByRole("img", { name: config.appName });
    expect(image).toHaveAttribute("src", "/brand/logo.png");
  });
});

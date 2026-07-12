import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PosAppSection } from "./pos-app-section";

const { mockConfig } = vi.hoisted(() => ({
  mockConfig: {
    posAppDownloadUrl: "",
  },
}));

vi.mock("@/lib/config", () => ({
  config: mockConfig,
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

describe("PosAppSection", () => {
  beforeEach(() => {
    mockConfig.posAppDownloadUrl = "";
  });

  it("renders the pos-app section anchor", () => {
    render(<PosAppSection />);
    expect(document.getElementById("pos-app")).toBeInTheDocument();
  });

  it("disables download CTA when NEXT_PUBLIC_POS_APP_DOWNLOAD_URL is unset", () => {
    render(<PosAppSection />);

    expect(
      screen.getByRole("button", { name: /download pos app/i }),
    ).toBeDisabled();
    expect(
      screen.getByText(/available for android — contact your administrator/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /download pos app/i })).toBeNull();
  });

  it("links download CTA to the configured APK URL with target _blank", () => {
    mockConfig.posAppDownloadUrl = "https://example.com/app.apk";

    render(<PosAppSection />);

    const downloadLink = screen.getByRole("link", {
      name: /download pos app/i,
    });
    expect(downloadLink).toHaveAttribute("href", "https://example.com/app.apk");
    expect(downloadLink).toHaveAttribute("target", "_blank");
    expect(downloadLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(
      screen.queryByRole("button", { name: /download pos app/i }),
    ).toBeNull();
  });

  it("includes a cashier sign-in link to /login", () => {
    render(<PosAppSection />);

    const signInLink = screen.getByRole("link", { name: /cashier sign in/i });
    expect(signInLink).toHaveAttribute("href", "/login");
  });
});

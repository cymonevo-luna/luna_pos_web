import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { AdminRouteGuard } from "./admin-route-guard";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useRouter: () => ({ replace }),
}));

vi.mock("@/lib/auth/context", () => ({
  useAuth: vi.fn(),
}));

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/context";

describe("AdminRouteGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "1", roles: ["operational"], merchant_id: "m-1" },
      isLoading: false,
    } as ReturnType<typeof useAuth>);
  });

  it("redirects operational users away from admin-only routes", async () => {
    vi.mocked(usePathname).mockReturnValue("/admin/users");

    render(
      <AdminRouteGuard>
        <div>Protected content</div>
      </AdminRouteGuard>,
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(
        expect.stringContaining("/admin/unauthorized"),
      );
      expect(replace).toHaveBeenCalledWith(
        expect.stringContaining("feature=users.manage"),
      );
    });
  });

  it("renders children when the route is allowed", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/purchases");

    const { getByText } = render(
      <AdminRouteGuard>
        <div>Protected content</div>
      </AdminRouteGuard>,
    );

    expect(getByText("Protected content")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects admin-only users away from manager routes", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "1", roles: ["admin"], merchant_id: "m-1" },
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(usePathname).mockReturnValue("/admin/cogs");

    render(
      <AdminRouteGuard>
        <div>Protected content</div>
      </AdminRouteGuard>,
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(
        expect.stringContaining("/admin/unauthorized"),
      );
      expect(replace).toHaveBeenCalledWith(
        expect.stringContaining("feature=cogs.view"),
      );
    });
  });

  it("redirects operational users away from receipt settings", async () => {
    vi.mocked(usePathname).mockReturnValue("/admin/store-settings");

    render(
      <AdminRouteGuard>
        <div>Protected content</div>
      </AdminRouteGuard>,
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(
        expect.stringContaining("/admin/unauthorized"),
      );
      expect(replace).toHaveBeenCalledWith(
        expect.stringContaining("feature=store_settings.manage"),
      );
    });
  });

  it("redirects operational users away from COGS summary", async () => {
    vi.mocked(usePathname).mockReturnValue("/admin/cogs/summary");

    render(
      <AdminRouteGuard>
        <div>Protected content</div>
      </AdminRouteGuard>,
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(
        expect.stringContaining("/admin/unauthorized"),
      );
      expect(replace).toHaveBeenCalledWith(
        expect.stringContaining("feature=cogs.view"),
      );
    });
  });

  it("allows manager users on production request list", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "1", roles: ["manager"], merchant_id: "m-1" },
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(usePathname).mockReturnValue("/admin/production-requests");

    const { getByText } = render(
      <AdminRouteGuard>
        <div>Protected content</div>
      </AdminRouteGuard>,
    );

    expect(getByText("Protected content")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});

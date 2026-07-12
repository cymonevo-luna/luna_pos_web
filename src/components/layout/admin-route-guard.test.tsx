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
      expect(replace).toHaveBeenCalledWith("/admin/suppliers");
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
});

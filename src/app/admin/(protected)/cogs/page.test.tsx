import { describe, it, expect, vi } from "vitest";
import { redirect } from "next/navigation";
import AdminCogsRedirectPage from "./page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("AdminCogsRedirectPage", () => {
  it("redirects /admin/cogs to menu breakdown", () => {
    AdminCogsRedirectPage();
    expect(redirect).toHaveBeenCalledWith("/admin/cogs/menu-breakdown");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { refreshTokenPair, resetRefreshInFlightForTests } from "./refresh";

describe("refreshTokenPair", () => {
  beforeEach(() => {
    resetRefreshInFlightForTests();
    vi.restoreAllMocks();
  });

  it("returns tokens and features on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            features: ["menus.manage"],
            tokens: {
              access_token: "new-access",
              refresh_token: "new-refresh",
              expires_in: 900,
            },
          },
        }),
      }),
    );

    const result = await refreshTokenPair("refresh-1");
    expect(result?.tokens.access_token).toBe("new-access");
    expect(result?.tokens.refresh_token).toBe("new-refresh");
    expect(result?.features).toEqual(["menus.manage"]);
  });

  it("returns null on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
      }),
    );

    expect(await refreshTokenPair("refresh-1")).toBeNull();
  });

  it("dedupes concurrent refresh calls", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          features: ["menus.manage"],
          tokens: {
            access_token: "new-access",
            refresh_token: "new-refresh",
            expires_in: 900,
          },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([
      refreshTokenPair("refresh-1"),
      refreshTokenPair("refresh-1"),
    ]);

    expect(first?.tokens.access_token).toBe("new-access");
    expect(second?.tokens.access_token).toBe("new-access");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

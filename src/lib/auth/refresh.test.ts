import { describe, it, expect, vi, beforeEach } from "vitest";
import { refreshTokenPair, resetRefreshInFlightForTests } from "./refresh";

describe("refreshTokenPair", () => {
  beforeEach(() => {
    resetRefreshInFlightForTests();
    vi.restoreAllMocks();
  });

  it("returns tokens on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            tokens: {
              access_token: "new-access",
              refresh_token: "new-refresh",
              expires_in: 900,
            },
          },
        }),
      }),
    );

    const tokens = await refreshTokenPair("refresh-1");
    expect(tokens?.access_token).toBe("new-access");
    expect(tokens?.refresh_token).toBe("new-refresh");
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

    expect(first?.access_token).toBe("new-access");
    expect(second?.access_token).toBe("new-access");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

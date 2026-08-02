import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { menuDisposalsAdminApi } from "@/lib/api/menu-disposals";
import { queryKeys } from "@/lib/query/keys";
import { useMenuDisposalSummaryByMenuQuery } from "@/lib/query/hooks/use-menu-disposal-summary-by-menu";
import { useMenuDisposalSummaryQuery } from "@/lib/query/hooks/use-menu-disposal-summary";
import { TestQueryProvider, createTestQueryClient } from "@/test/query-provider";

vi.mock("@/lib/api/menu-disposals", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/menu-disposals")>();
  return {
    ...actual,
    menuDisposalsAdminApi: {
      ...actual.menuDisposalsAdminApi,
      summary: vi.fn(),
      summaryByMenu: vi.fn(),
    },
  };
});

function useSummaryHarness({
  summaryPeriod,
  byMenuPeriod,
}: {
  summaryPeriod: "daily" | "weekly";
  byMenuPeriod: "daily" | "monthly";
}) {
  useMenuDisposalSummaryQuery({ period: summaryPeriod });
  useMenuDisposalSummaryByMenuQuery({ period: byMenuPeriod });
}

describe("menu disposal summary query hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(menuDisposalsAdminApi.summary).mockResolvedValue({
      data: {
        period: "daily",
        date_from: "2026-01-01T00:00:00.000Z",
        date_to: "2026-01-31T23:59:59.999Z",
        totals: { count: 0, total_amount: 0, total_quantity: 0 },
        buckets: [],
      },
    });
    vi.mocked(menuDisposalsAdminApi.summaryByMenu).mockResolvedValue({
      data: {
        period: "daily",
        date_from: "2026-01-01T00:00:00.000Z",
        date_to: "2026-01-31T23:59:59.999Z",
        total_loss_amount: 0,
        total_quantity: 0,
        total_count: 0,
        menus: [],
      },
    });
  });

  it("uses distinct cache keys for different periods and endpoints", () => {
    const queryClient = createTestQueryClient();

    renderHook(
      () =>
        useSummaryHarness({
          summaryPeriod: "daily",
          byMenuPeriod: "monthly",
        }),
      {
        wrapper: ({ children }) => (
          <TestQueryProvider client={queryClient}>{children}</TestQueryProvider>
        ),
      },
    );

    const keys = queryClient
      .getQueryCache()
      .getAll()
      .map((query) => query.queryKey);

    const dailySummaryKey = queryKeys.menuDisposals.summary({ period: "daily" });
    const weeklySummaryKey = queryKeys.menuDisposals.summary({ period: "weekly" });
    const monthlyByMenuKey = queryKeys.menuDisposals.summaryByMenu({
      period: "monthly",
    });

    expect(keys).toContainEqual(dailySummaryKey);
    expect(keys).toContainEqual(monthlyByMenuKey);
    expect(dailySummaryKey).not.toEqual(weeklySummaryKey);
    expect(dailySummaryKey).not.toEqual(monthlyByMenuKey);

    renderHook(
      () =>
        useSummaryHarness({
          summaryPeriod: "weekly",
          byMenuPeriod: "monthly",
        }),
      {
        wrapper: ({ children }) => (
          <TestQueryProvider client={queryClient}>{children}</TestQueryProvider>
        ),
      },
    );

    const updatedKeys = queryClient
      .getQueryCache()
      .getAll()
      .map((query) => query.queryKey);

    expect(updatedKeys).toContainEqual(weeklySummaryKey);
    expect(
      updatedKeys.some(
        (key) => JSON.stringify(key) === JSON.stringify(weeklySummaryKey),
      ),
    ).toBe(true);
  });
});

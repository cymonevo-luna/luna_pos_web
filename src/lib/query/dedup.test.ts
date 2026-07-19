import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { transactionsAdminApi } from "@/lib/api/transactions";
import { queryKeys } from "@/lib/query/keys";

vi.mock("@/lib/api/transactions", () => ({
  transactionsAdminApi: {
    summary: vi.fn(),
  },
}));

describe("query key deduplication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shares one in-flight request for identical transaction summary keys", async () => {
    let resolveSummary!: (value: {
      data: { period: "daily"; buckets: [] };
    }) => void;
    const summaryPromise = new Promise<{
      data: { period: "daily"; buckets: [] };
    }>((resolve) => {
      resolveSummary = resolve;
    });

    vi.mocked(transactionsAdminApi.summary).mockReturnValue(summaryPromise);

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const params = {
      period: "daily" as const,
      dateFrom: "2026-06-19",
      dateTo: "2026-07-19",
    };

    const first = client.fetchQuery({
      queryKey: queryKeys.transactions.summary(params),
      queryFn: () => transactionsAdminApi.summary(params),
    });
    const second = client.fetchQuery({
      queryKey: queryKeys.transactions.summary(params),
      queryFn: () => transactionsAdminApi.summary(params),
    });

    resolveSummary({ data: { period: "daily", buckets: [] } });

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult).toEqual(secondResult);
    expect(transactionsAdminApi.summary).toHaveBeenCalledTimes(1);
  });
});

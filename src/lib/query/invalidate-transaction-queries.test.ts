import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { transactionsAdminApi } from "@/lib/api/transactions";
import { queryKeys } from "@/lib/query/keys";
import { invalidateTransactionQueries } from "./invalidate-transaction-queries";

vi.mock("@/lib/api/transactions", () => ({
  transactionsAdminApi: {
    list: vi.fn(),
    summary: vi.fn(),
  },
}));

describe("invalidateTransactionQueries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks list and summary queries stale and refetches them", async () => {
    const listParams = {
      page: 1,
      perPage: 10,
      method: "" as const,
      dateFrom: "",
      dateTo: "",
    };
    const summaryParams = {
      period: "daily" as const,
      dateFrom: "2026-06-19",
      dateTo: "2026-07-19",
    };

    vi.mocked(transactionsAdminApi.list).mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 10, total: 0 },
    });
    vi.mocked(transactionsAdminApi.summary).mockResolvedValue({
      data: { period: "daily", buckets: [] },
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await queryClient.prefetchQuery({
      queryKey: queryKeys.transactions.list(listParams),
      queryFn: () => transactionsAdminApi.list(listParams),
    });
    await queryClient.prefetchQuery({
      queryKey: queryKeys.transactions.summary(summaryParams),
      queryFn: () => transactionsAdminApi.summary(summaryParams),
    });

    expect(transactionsAdminApi.list).toHaveBeenCalledTimes(1);
    expect(transactionsAdminApi.summary).toHaveBeenCalledTimes(1);

    const listState = queryClient.getQueryState(
      queryKeys.transactions.list(listParams),
    );
    const summaryState = queryClient.getQueryState(
      queryKeys.transactions.summary(summaryParams),
    );
    expect(listState?.isInvalidated).toBe(false);
    expect(summaryState?.isInvalidated).toBe(false);

    await invalidateTransactionQueries(queryClient);

    const invalidatedListState = queryClient.getQueryState(
      queryKeys.transactions.list(listParams),
    );
    const invalidatedSummaryState = queryClient.getQueryState(
      queryKeys.transactions.summary(summaryParams),
    );
    expect(invalidatedListState?.isInvalidated).toBe(true);
    expect(invalidatedSummaryState?.isInvalidated).toBe(true);

    await queryClient.refetchQueries({ queryKey: queryKeys.transactions.all });

    expect(transactionsAdminApi.list).toHaveBeenCalledTimes(2);
    expect(transactionsAdminApi.summary).toHaveBeenCalledTimes(2);
  });
});

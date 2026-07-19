import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { invalidatePurchaseRequestQueries } from "./invalidate-purchase-request-queries";
import { queryKeys } from "./keys";

describe("invalidatePurchaseRequestQueries", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    vi.spyOn(queryClient, "invalidateQueries");
  });

  it("invalidates purchase request list queries", async () => {
    await invalidatePurchaseRequestQueries(queryClient);

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.purchaseRequests.lists(),
    });
  });
});

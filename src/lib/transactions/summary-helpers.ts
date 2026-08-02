import type { TransactionSummaryBucket } from "@/lib/api/types";

export function sumBucketAmounts(
  buckets: Pick<TransactionSummaryBucket, "total_amount">[] | undefined,
): number {
  return (buckets ?? []).reduce((sum, bucket) => sum + bucket.total_amount, 0);
}

export function sumBucketCounts(
  buckets: Pick<TransactionSummaryBucket, "count">[] | undefined,
): number {
  return (buckets ?? []).reduce((sum, bucket) => sum + bucket.count, 0);
}

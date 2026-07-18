"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Building2, Layers, RefreshCw, Scale } from "lucide-react";
import { getBranchAssetsSummary } from "@/lib/api/branch-assets";
import { ApiError } from "@/lib/api/client";
import type { BranchAssetsSummary } from "@/lib/api/types";
import { cn, formatRupiah } from "@/lib/utils";
import { toast } from "sonner";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

const DEFAULT_PROFIT_LOOKBACK_DAYS = 30;

function StatCardSkeleton() {
  return (
    <Card className="p-4" data-testid="branch-assets-stat-skeleton">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <Skeleton className="mt-3 h-8 w-24" />
      <Skeleton className="mt-2 h-4 w-32" />
    </Card>
  );
}

export interface BranchAssetsSummarySectionProps {
  className?: string;
  profitLookbackDays?: number;
}

export function BranchAssetsSummarySection({
  className,
  profitLookbackDays = DEFAULT_PROFIT_LOOKBACK_DAYS,
}: BranchAssetsSummarySectionProps) {
  const [summary, setSummary] = useState<BranchAssetsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const res = await getBranchAssetsSummary({ profitLookbackDays });
        setSummary(res.data ?? null);
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "Failed to load branch assets summary";
        setError(message);
        toast.error(message);
        setSummary(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [profitLookbackDays],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={cn("space-y-6", className)} data-testid="branch-assets-summary-section">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/admin/branch-assets"
          className={buttonVariants({ variant: "outline", size: "sm" })}
          data-testid="branch-assets-back-link"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to asset list
        </Link>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load(true)}
          disabled={loading || refreshing}
          data-testid="branch-assets-summary-refresh"
        >
          <RefreshCw
            className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")}
          />
          Refresh
        </Button>
      </div>

      {error && !loading ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <StatCardSkeleton key={index} />
          ))}
        </div>
      ) : (
        <>
          <div
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            data-testid="total-asset-value-card"
          >
            <StatCard
              label="Total Asset Value"
              value={formatRupiah(summary?.total_asset_value ?? 0)}
              icon={Building2}
              color="blue"
            />
            <StatCard
              label="Asset Count"
              value={summary?.asset_count ?? 0}
              icon={Layers}
              color="purple"
            />
            <StatCard
              label="Total Quantity"
              value={summary?.total_quantity ?? 0}
              icon={Scale}
              color="teal"
            />
          </div>

          <Link
            href="/admin/cash-flow/bep"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "inline-flex w-fit items-center",
            )}
            data-testid="branch-assets-bep-link"
          >
            View BEP projection
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </>
      )}
    </div>
  );
}

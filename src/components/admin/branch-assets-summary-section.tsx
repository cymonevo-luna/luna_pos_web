"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  Layers,
  RefreshCw,
  Scale,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const DEFAULT_PROFIT_LOOKBACK_DAYS = 30;

function formatBepValue(value: number | null | undefined): string {
  if (value == null) return "N/A";
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

function StatCardSkeleton() {
  return (
    <Card className="p-4" data-testid="branch-assets-stat-skeleton">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <Skeleton className="mt-3 h-8 w-24" />
      <Skeleton className="mt-2 h-4 w-32" />
    </Card>
  );
}

interface ComparisonTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
  }>;
}

function ComparisonTooltip({ active, payload }: ComparisonTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {formatRupiah(entry.value ?? 0)}
        </p>
      ))}
    </div>
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

  const comparisonData =
    summary == null
      ? []
      : [
          {
            label: "Capital vs profit",
            asset_value: summary.total_asset_value,
            monthly_profit: summary.profit_monthly_avg,
          },
        ];

  const bepUnreachable = summary != null && !summary.bep_reachable;

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
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <StatCardSkeleton key={index} />
            ))}
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="mt-2 h-4 w-72" />
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <StatCardSkeleton key={index} />
              ))}
            </CardContent>
          </Card>
        </>
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

          <Card
            className={cn(
              bepUnreachable && "border-muted bg-muted/30",
            )}
            data-testid="branch-assets-bep-section"
          >
            <CardHeader>
              <CardTitle>Projected break-even</CardTitle>
              <CardDescription>
                Informational projection based on recent profit averages. Not
                financial advice.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Daily profit average"
                  value={formatRupiah(summary?.profit_daily_avg ?? 0)}
                  subtitle={summary?.profit_source}
                  icon={TrendingUp}
                  color="green"
                />
                <StatCard
                  label="Monthly profit average"
                  value={formatRupiah(summary?.profit_monthly_avg ?? 0)}
                  icon={CalendarClock}
                  color="amber"
                />
                <div data-testid="bep-days-card">
                  <StatCard
                    label="BEP (days)"
                    value={formatBepValue(summary?.bep_days)}
                    subtitle={summary?.bep_message ?? undefined}
                    icon={CalendarClock}
                    color={bepUnreachable ? "red" : "blue"}
                  />
                </div>
                <div data-testid="bep-months-card">
                  <StatCard
                    label="BEP (months)"
                    value={formatBepValue(summary?.bep_months)}
                    icon={CalendarClock}
                    color={bepUnreachable ? "red" : "blue"}
                  />
                </div>
              </div>

              {bepUnreachable && summary?.bep_message ? (
                <p
                  className="text-sm text-muted-foreground"
                  data-testid="bep-unreachable-message"
                >
                  {summary.bep_message} More sales data or positive profit is
                  needed to project break-even.
                </p>
              ) : null}

              {comparisonData.length > 0 &&
              (summary?.total_asset_value ?? 0) + (summary?.profit_monthly_avg ?? 0) >
                0 ? (
                <div className="space-y-2" data-testid="branch-assets-comparison-chart">
                  <p className="text-sm font-medium">Asset value vs monthly profit</p>
                  <div className="h-[240px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={comparisonData}
                        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-border"
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 12 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 12 }}
                          tickLine={false}
                          axisLine={false}
                          width={56}
                          tickFormatter={(value: number) =>
                            value >= 1_000_000
                              ? `${Math.round(value / 1_000_000)}M`
                              : value >= 1_000
                                ? `${Math.round(value / 1_000)}K`
                                : String(value)
                          }
                        />
                        <Tooltip content={<ComparisonTooltip />} />
                        <Legend />
                        <Bar
                          dataKey="asset_value"
                          name="Total asset value"
                          fill="var(--chart-1)"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={48}
                        />
                        <Bar
                          dataKey="monthly_profit"
                          name="Monthly profit avg"
                          fill="var(--chart-2)"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={48}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

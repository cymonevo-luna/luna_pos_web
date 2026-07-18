"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  bepProjection,
  formatBEPHistoricalSubtitle,
} from "@/lib/api/insights";
import { ApiError } from "@/lib/api/client";
import type {
  BEPProjectionBucket,
  BEPProjectionResponse,
  UpcomingRecurringExpense,
} from "@/lib/api/types";
import { cn, formatBepValue, formatDateTime, formatRupiah } from "@/lib/utils";
import { toast } from "sonner";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const DEFAULT_PROFIT_LOOKBACK_DAYS = 30;
const DEFAULT_PROJECTION_DAYS = 90;

const PROFIT_LOOKBACK_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
  { value: "45", label: "45 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
];

const PROJECTION_DAYS_OPTIONS = [
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
];

function StatCardSkeleton() {
  return (
    <Card className="p-4" data-testid="bep-stat-skeleton">
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

interface ProjectionTooltipProps {
  active?: boolean;
  payload?: Array<{
    value?: number;
    payload: BEPProjectionBucket;
  }>;
}

function ProjectionTooltip({ active, payload }: ProjectionTooltipProps) {
  if (!active || !payload?.length) return null;
  const bucket = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium">Day {bucket.day_offset + 1}</p>
      <p className="text-muted-foreground">{bucket.date}</p>
      <p>Net: {formatRupiah(bucket.projected_net)}</p>
      <p className="font-medium">
        Cumulative: {formatRupiah(bucket.cumulative_net)}
      </p>
    </div>
  );
}

const recurringExpenseColumns: Column<UpcomingRecurringExpense>[] = [
  {
    header: "Title",
    cell: (row) => row.title,
  },
  {
    header: "Amount",
    cell: (row) => formatRupiah(row.amount),
    className: "text-right",
  },
  {
    header: "Next run",
    cell: (row) => formatDateTime(row.next_run_at),
    className: "text-right",
  },
];

export interface BEPProjectionSectionProps {
  className?: string;
}

export function BEPProjectionSection({ className }: BEPProjectionSectionProps) {
  const [profitLookbackDays, setProfitLookbackDays] = useState(
    String(DEFAULT_PROFIT_LOOKBACK_DAYS),
  );
  const [projectionDays, setProjectionDays] = useState(
    String(DEFAULT_PROJECTION_DAYS),
  );
  const [data, setData] = useState<BEPProjectionResponse | null>(null);
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
        const res = await bepProjection({
          profitLookbackDays: Number(profitLookbackDays),
          projectionDays: Number(projectionDays),
        });
        setData(res.data ?? null);
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "Failed to load break-even projection";
        setError(message);
        toast.error(message);
        setData(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [profitLookbackDays, projectionDays],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const bepUnreachable = data != null && !data.bep.bep_reachable;

  const comparisonData =
    data == null
      ? []
      : [
          {
            label: "Capital vs profit",
            asset_value: data.total_asset_value,
            monthly_profit: data.historical.profit_monthly_avg,
          },
        ];

  const projectionChartData = data?.projection.buckets ?? [];

  return (
    <div
      className={cn("space-y-6", className)}
      data-testid="bep-projection-section"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/admin/cash-flow"
          className={buttonVariants({ variant: "outline", size: "sm" })}
          data-testid="bep-back-link"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to cash flow
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            aria-label="Profit lookback days"
            value={profitLookbackDays}
            onChange={(e) => setProfitLookbackDays(e.target.value)}
            className="w-full sm:w-40"
            options={PROFIT_LOOKBACK_OPTIONS}
            data-testid="bep-profit-lookback-select"
          />
          <Select
            aria-label="Projection days"
            value={projectionDays}
            onChange={(e) => setProjectionDays(e.target.value)}
            className="w-full sm:w-40"
            options={PROJECTION_DAYS_OPTIONS}
            data-testid="bep-projection-days-select"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void load(true)}
            disabled={loading || refreshing}
            data-testid="bep-projection-refresh"
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")}
            />
            Refresh
          </Button>
        </div>
      </div>

      {error && !loading ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <StatCardSkeleton key={index} />
          ))}
        </div>
      ) : (
        <>
          <Card
            className={cn(bepUnreachable && "border-muted bg-muted/30")}
            data-testid="bep-metrics-section"
          >
            <CardHeader>
              <CardTitle>Break-even projection</CardTitle>
              <CardDescription>
                Informational projection based on recent profit averages. Not
                financial advice.
              </CardDescription>
              {data?.generated_at ? (
                <p className="text-xs text-muted-foreground">
                  Generated {formatDateTime(data.generated_at)}
                </p>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Total asset value"
                  value={formatRupiah(data?.total_asset_value ?? 0)}
                  icon={Building2}
                  color="blue"
                />
                <StatCard
                  label="Daily profit average"
                  value={formatRupiah(data?.historical.profit_daily_avg ?? 0)}
                  subtitle={
                    data
                      ? formatBEPHistoricalSubtitle(data.historical)
                      : undefined
                  }
                  icon={TrendingUp}
                  color="green"
                />
                <StatCard
                  label="Monthly profit average"
                  value={formatRupiah(data?.historical.profit_monthly_avg ?? 0)}
                  icon={CalendarClock}
                  color="amber"
                />
                <div data-testid="bep-days-card">
                  <StatCard
                    label="BEP (days)"
                    value={formatBepValue(data?.bep.bep_days)}
                    subtitle={data?.bep.bep_message ?? undefined}
                    icon={CalendarClock}
                    color={bepUnreachable ? "red" : "blue"}
                  />
                </div>
                <div data-testid="bep-months-card">
                  <StatCard
                    label="BEP (months)"
                    value={formatBepValue(data?.bep.bep_months)}
                    icon={CalendarClock}
                    color={bepUnreachable ? "red" : "blue"}
                  />
                </div>
              </div>

              {bepUnreachable && data?.bep.bep_message ? (
                <p
                  className="text-sm text-muted-foreground"
                  data-testid="bep-unreachable-message"
                >
                  {data.bep.bep_message} More sales data or positive profit is
                  needed to project break-even.
                </p>
              ) : null}

              {comparisonData.length > 0 &&
              (data?.total_asset_value ?? 0) +
                (data?.historical.profit_monthly_avg ?? 0) >
                0 ? (
                <div
                  className="space-y-2"
                  data-testid="bep-comparison-chart"
                >
                  <p className="text-sm font-medium">
                    Asset value vs monthly profit
                  </p>
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

          <Card data-testid="bep-projection-chart-section">
            <CardHeader>
              <CardTitle>Forward cash-flow projection</CardTitle>
              <CardDescription>
                Cumulative projected net cash flow over the next{" "}
                {data?.projection.projection_days ?? projectionDays} days,
                assuming lookback daily averages continue unchanged.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {projectionChartData.length > 0 ? (
                <div
                  className="h-[280px] w-full"
                  data-testid="bep-projection-chart"
                  data-point-count={projectionChartData.length}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={projectionChartData}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border"
                      />
                      <XAxis
                        dataKey="day_offset"
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value: number) => `D${value + 1}`}
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
                      <Tooltip content={<ProjectionTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="cumulative_net"
                        name="Cumulative net"
                        stroke="var(--chart-1)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No projection data available.
                </p>
              )}
            </CardContent>
          </Card>

          <Card data-testid="bep-upcoming-expenses-section">
            <CardHeader>
              <CardTitle>Upcoming recurring expenses</CardTitle>
              <CardDescription>
                Active recurring expenses due within the projection window.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={recurringExpenseColumns}
                rows={data?.projection.upcoming_recurring_expenses ?? []}
                getRowKey={(row) => row.recurring_expense_id}
                loading={loading}
                emptyMessage="No upcoming recurring expenses in this projection window"
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

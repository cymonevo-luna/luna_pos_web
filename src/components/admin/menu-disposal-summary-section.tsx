"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Hash, Package, Trash2 } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import type {
  MenuDisposalByMenuItem,
  MenuDisposalSummaryBucket,
  MenuDisposalSummaryPeriod,
} from "@/lib/api/types";
import { useMenuDisposalSummaryByMenuQuery } from "@/lib/query/hooks/use-menu-disposal-summary-by-menu";
import { useMenuDisposalSummaryQuery } from "@/lib/query/hooks/use-menu-disposal-summary";
import { defaultReportRange, withWibPeriodLabels } from "@/lib/datetime";
import { cn, formatRupiah } from "@/lib/utils";
import { toast } from "sonner";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const PERIODS: { value: MenuDisposalSummaryPeriod; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

type TrendMetric = "amount" | "count";

function formatDisposalCount(count: number): string {
  return `${count} ${count === 1 ? "disposal" : "disposals"}`;
}

function formatSharePercent(value: number | null | undefined): string {
  const n = Number(value);
  return `${(Number.isFinite(n) ? n : 0).toFixed(1)}%`;
}

interface TrendTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: MenuDisposalSummaryBucket;
  }>;
}

function TrendTooltip({ active, payload }: TrendTooltipProps) {
  if (!active || !payload?.length) return null;
  const bucket = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{bucket.period_label}</p>
      <p className="text-muted-foreground">
        Loss: {formatRupiah(bucket.total_amount)}
      </p>
      <p className="text-muted-foreground">
        {formatDisposalCount(bucket.count)}
      </p>
      <p className="text-muted-foreground">Qty: {bucket.total_quantity}</p>
    </div>
  );
}

interface MenuPieTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: MenuDisposalByMenuItem & { fill?: string };
  }>;
}

function MenuPieTooltip({ active, payload }: MenuPieTooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{item.menu_title}</p>
      <p className="text-muted-foreground">
        Loss: {formatRupiah(item.loss_amount)}
      </p>
      <p className="text-muted-foreground">Qty: {item.quantity_disposed}</p>
      <p className="font-medium">{formatSharePercent(item.loss_share_percent)}</p>
    </div>
  );
}

const menuTableColumns: Column<MenuDisposalByMenuItem>[] = [
  {
    header: "Menu",
    cell: (row) => row.menu_title,
  },
  {
    header: "Qty disposed",
    cell: (row) => row.quantity_disposed,
    className: "text-right",
  },
  {
    header: "Loss",
    cell: (row) => formatRupiah(row.loss_amount),
    className: "text-right",
  },
  {
    header: "Share",
    cell: (row) => formatSharePercent(row.loss_share_percent),
    className: "text-right",
  },
];

function StatCardSkeleton() {
  return (
    <Card className="p-4" data-testid="menu-disposal-stat-skeleton">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <Skeleton className="mt-3 h-8 w-24" />
      <Skeleton className="mt-2 h-4 w-32" />
    </Card>
  );
}

export interface MenuDisposalSummarySectionProps {
  className?: string;
}

export function MenuDisposalSummarySection({
  className,
}: MenuDisposalSummarySectionProps) {
  const defaults = defaultReportRange();
  const [period, setPeriod] = useState<MenuDisposalSummaryPeriod>("daily");
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("amount");

  const queryParams = { period, dateFrom, dateTo };

  const {
    data: summaryData,
    isLoading: summaryLoading,
    isError: summaryError,
    error: summaryErrorObj,
  } = useMenuDisposalSummaryQuery(queryParams);

  const {
    data: byMenuData,
    isLoading: byMenuLoading,
    isError: byMenuError,
    error: byMenuErrorObj,
  } = useMenuDisposalSummaryByMenuQuery(queryParams);

  useEffect(() => {
    if (summaryError) {
      toast.error(
        summaryErrorObj instanceof ApiError
          ? summaryErrorObj.message
          : "Failed to load menu disposal summary",
      );
    }
  }, [summaryError, summaryErrorObj]);

  useEffect(() => {
    if (byMenuError) {
      toast.error(
        byMenuErrorObj instanceof ApiError
          ? byMenuErrorObj.message
          : "Failed to load menu disposal breakdown",
      );
    }
  }, [byMenuError, byMenuErrorObj]);

  const totals = summaryData?.data?.totals;
  const buckets = useMemo(
    () => withWibPeriodLabels(summaryData?.data?.buckets ?? [], period),
    [summaryData?.data?.buckets, period],
  );
  const menus = byMenuData?.data?.menus ?? [];

  const chartData = useMemo(
    () =>
      menus.map((item, index) => ({
        ...item,
        fill: CHART_COLORS[index % CHART_COLORS.length],
      })),
    [menus],
  );

  const trendDataKey = trendMetric === "amount" ? "total_amount" : "count";
  const trendBarName = trendMetric === "amount" ? "Loss amount" : "Disposal count";
  const trendBarColor =
    trendMetric === "amount" ? "var(--chart-1)" : "var(--chart-2)";

  return (
    <Card
      className={cn(className)}
      data-testid="menu-disposal-summary-section"
    >
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Disposal summary</CardTitle>
            <CardDescription>
              Loss trends and breakdown by menu for the selected period
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div
              className="flex rounded-xl border border-input p-1"
              role="group"
              aria-label="Summary period"
            >
              {PERIODS.map((item) => (
                <Button
                  key={item.value}
                  type="button"
                  size="sm"
                  variant={period === item.value ? "default" : "ghost"}
                  onClick={() => setPeriod(item.value)}
                  aria-pressed={period === item.value}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            <Input
              type="date"
              aria-label="Summary date from"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full sm:w-40"
              data-testid="menu-disposal-summary-date-from"
            />
            <Input
              type="date"
              aria-label="Summary date to"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full sm:w-40"
              data-testid="menu-disposal-summary-date-to"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {summaryLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <StatCardSkeleton key={index} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Total loss"
              value={formatRupiah(totals?.total_amount ?? 0)}
              icon={Trash2}
              color="red"
            />
            <StatCard
              label="Disposal count"
              value={totals?.count ?? 0}
              subtitle={
                totals == null ? undefined : formatDisposalCount(totals.count)
              }
              icon={Hash}
              color="amber"
            />
            <StatCard
              label="Total quantity"
              value={totals?.total_quantity ?? 0}
              icon={Package}
              color="purple"
            />
          </div>
        )}

        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-medium">Disposal trend</h3>
            <div
              className="flex rounded-xl border border-input p-1"
              role="group"
              aria-label="Trend metric"
            >
              <Button
                type="button"
                size="sm"
                variant={trendMetric === "amount" ? "default" : "ghost"}
                onClick={() => setTrendMetric("amount")}
                aria-pressed={trendMetric === "amount"}
              >
                Amount
              </Button>
              <Button
                type="button"
                size="sm"
                variant={trendMetric === "count" ? "default" : "ghost"}
                onClick={() => setTrendMetric("count")}
                aria-pressed={trendMetric === "count"}
              >
                Count
              </Button>
            </div>
          </div>

          {summaryLoading ? (
            <Skeleton
              className="h-[280px] w-full rounded-xl"
              data-testid="menu-disposal-trend-chart-loading"
            />
          ) : buckets.length === 0 ? (
            <div
              className="flex h-[280px] items-center justify-center text-muted-foreground"
              data-testid="menu-disposal-trend-empty"
            >
              No disposals in this period
            </div>
          ) : (
            <div
              className="h-[280px] w-full"
              data-testid="menu-disposal-trend-chart"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={buckets}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                  />
                  <XAxis
                    dataKey="period_label"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tickFormatter={(value: number) =>
                      trendMetric === "amount"
                        ? value >= 1_000_000
                          ? `${Math.round(value / 1_000_000)}M`
                          : value >= 1_000
                            ? `${Math.round(value / 1_000)}K`
                            : String(value)
                        : String(value)
                    }
                  />
                  <Tooltip content={<TrendTooltip />} />
                  <Bar
                    dataKey={trendDataKey}
                    name={trendBarName}
                    fill={trendBarColor}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium">Loss by menu</h3>
          {byMenuLoading ? (
            <Skeleton
              className="mx-auto h-[280px] max-w-md rounded-full"
              data-testid="menu-disposal-menu-pie-chart-loading"
            />
          ) : chartData.length === 0 ? (
            <div
              className="flex h-[280px] items-center justify-center text-muted-foreground"
              data-testid="menu-disposal-menu-pie-empty"
            >
              No menu disposals in this period
            </div>
          ) : (
            <div
              className="h-[280px] w-full"
              data-testid="menu-disposal-menu-pie-chart"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="loss_amount"
                    nameKey="menu_title"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) =>
                      `${name ?? ""} (${((percent ?? 0) * 100).toFixed(0)}%)`
                    }
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.menu_id} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<MenuPieTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          <DataTable
            columns={menuTableColumns}
            rows={menus}
            getRowKey={(row) => row.menu_id}
            loading={byMenuLoading}
            emptyMessage="No menu disposals in this period"
          />
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ApiError } from "@/lib/api/client";
import type {
  TransactionSummaryBucket,
  TransactionSummaryPeriod,
} from "@/lib/api/types";
import { useTransactionSummaryQuery } from "@/lib/query/hooks/use-transaction-summary";
import { getDefaultTransactionDateRange } from "@/lib/query/date-range";
import { withWibPeriodLabels } from "@/lib/datetime";
import { cn, formatRupiah } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const PERIODS: { value: TransactionSummaryPeriod; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const CHART_COLORS = {
  revenue: "var(--chart-2)",
  transactions: "var(--chart-1)",
} as const;

function formatCompactAmount(value: number): string {
  if (value >= 1_000_000) {
    return `${Math.round(value / 1_000_000)}M`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K`;
  }
  return String(value);
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
    payload: TransactionSummaryBucket;
  }>;
}

function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const bucket = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{bucket.period_label}</p>
      <p style={{ color: CHART_COLORS.revenue }}>
        Revenue: {formatRupiah(bucket.total_amount)}
      </p>
      <p style={{ color: CHART_COLORS.transactions }}>
        {bucket.count} {bucket.count === 1 ? "transaction" : "transactions"}
      </p>
    </div>
  );
}

interface TransactionTrendChartProps {
  className?: string;
}

export function TransactionTrendChart({ className }: TransactionTrendChartProps) {
  const defaults = getDefaultTransactionDateRange();
  const [period, setPeriod] = useState<TransactionSummaryPeriod>("daily");
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);

  const { data, isLoading, isError, error } = useTransactionSummaryQuery({
    period,
    dateFrom,
    dateTo,
  });

  useEffect(() => {
    if (isError) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Failed to load transaction summary",
      );
    }
  }, [isError, error]);

  const buckets = useMemo(
    () => withWibPeriodLabels(data?.data?.buckets ?? [], period),
    [data?.data?.buckets, period],
  );

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Transaction trends</CardTitle>
            <CardDescription>
              Revenue and transaction volume by period
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div
              className="flex rounded-xl border border-input p-1"
              role="group"
              aria-label="Period"
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
              aria-label="Trend chart date from"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full sm:w-40"
            />
            <Input
              type="date"
              aria-label="Trend chart date to"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full sm:w-40"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3" data-testid="trend-chart-loading">
            <Skeleton className="h-[280px] w-full rounded-xl" />
          </div>
        ) : buckets.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-muted-foreground">
            No transactions in this period
          </div>
        ) : (
          <div
            className="h-[280px] w-full"
            data-testid="transaction-trend-chart"
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={buckets}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="period_label"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="amount"
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={formatCompactAmount}
                />
                <YAxis
                  yAxisId="count"
                  orientation="right"
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend />
                <Bar
                  yAxisId="amount"
                  dataKey="total_amount"
                  name="Revenue"
                  fill={CHART_COLORS.revenue}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Line
                  yAxisId="count"
                  type="monotone"
                  dataKey="count"
                  name="Transactions"
                  stroke={CHART_COLORS.transactions}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

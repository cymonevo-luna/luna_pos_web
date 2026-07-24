"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Factory,
  Scale,
} from "lucide-react";
import { cashFlowSummary } from "@/lib/api/insights";
import { ApiError } from "@/lib/api/client";
import type {
  CashFlowInflowByMethodNormalized,
  CashFlowOutflowBySourceNormalized,
  CashFlowOutflowSource,
  CashFlowSummary,
  CashFlowSummaryBucket,
  TransactionSummaryPeriod,
} from "@/lib/api/types";
import { cn, formatRupiah } from "@/lib/utils";
import { toast } from "sonner";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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

const OUTFLOW_SOURCE_LABELS: Record<CashFlowOutflowSource, string> = {
  purchases: "Purchases",
  expenses: "Expenses",
  staff_payouts: "Staff payouts",
  menu_disposals: "Menu Disposals",
};

const OUTFLOW_SOURCE_COLORS: Record<CashFlowOutflowSource, string> = {
  purchases: "var(--chart-1)",
  expenses: "var(--chart-2)",
  staff_payouts: "var(--chart-3)",
  menu_disposals: "var(--chart-5)",
};

function formatDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getDefaultDateRange() {
  const dateTo = new Date();
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - 30);
  return {
    dateFrom: formatDateInput(dateFrom),
    dateTo: formatDateInput(dateTo),
  };
}

function formatTransactionCount(count: number): string {
  return `${count} ${count === 1 ? "transaction" : "transactions"}`;
}

function formatPaymentCount(count: number): string {
  return `${count} ${count === 1 ? "payment" : "payments"}`;
}

function formatCompletedRequestCount(count: number): string {
  return `${count} completed ${count === 1 ? "request" : "requests"}`;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
    payload: CashFlowSummaryBucket;
  }>;
}

function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const bucket = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{bucket.period_label}</p>
      <p className="text-emerald-600 dark:text-emerald-400">
        Customer transactions: {formatRupiah(bucket.inflow_amount)}
      </p>
      <p className="text-amber-600 dark:text-amber-400">
        Outflow: {formatRupiah(bucket.outflow_amount)}
      </p>
      {bucket.production_cost_amount != null && (
        <p className="text-violet-600 dark:text-violet-400">
          Production cost: {formatRupiah(bucket.production_cost_amount)}
        </p>
      )}
      <p className="font-medium">Net: {formatRupiah(bucket.net_amount)}</p>
    </div>
  );
}

interface OutflowPieTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: CashFlowOutflowBySourceNormalized & {
      label: string;
      fill?: string;
    };
  }>;
}

function OutflowPieTooltip({ active, payload }: OutflowPieTooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{item.label}</p>
      <p className="text-muted-foreground">{formatRupiah(item.amount)}</p>
      <p className="text-muted-foreground">{formatPaymentCount(item.count)}</p>
    </div>
  );
}

function InflowMethodLegend({
  items,
}: {
  items: CashFlowInflowByMethodNormalized[];
}) {
  if (!items.length) return null;

  return (
    <div className="space-y-2" data-testid="cash-flow-inflow-by-method">
      <p className="text-sm font-medium text-muted-foreground">
        Customer transactions by payment method
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge
            key={item.method}
            variant="secondary"
            className="gap-2 px-3 py-1"
          >
            <span className="font-medium">{item.method}</span>
            <span>{formatRupiah(item.amount)}</span>
            <span className="text-muted-foreground">
              ({formatTransactionCount(item.count)})
            </span>
          </Badge>
        ))}
      </div>
    </div>
  );
}

function OutflowBreakdownChart({
  items,
}: {
  items: CashFlowOutflowBySourceNormalized[];
}) {
  const chartData = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        label: OUTFLOW_SOURCE_LABELS[item.source] ?? item.source,
      })),
    [items],
  );

  if (!chartData.length) return null;

  return (
    <div className="space-y-3" data-testid="cash-flow-outflow-breakdown">
      <div>
        <h3 className="text-sm font-medium">Outflow breakdown</h3>
        <p className="text-sm text-muted-foreground">
          Purchases, expenses, staff payouts, and menu disposals in this period
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center">
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="amount"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={80}
                paddingAngle={2}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.source}
                    fill={OUTFLOW_SOURCE_COLORS[entry.source]}
                  />
                ))}
              </Pie>
              <Tooltip content={<OutflowPieTooltip />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-2">
          {chartData.map((item) => (
            <Badge
              key={item.source}
              variant="secondary"
              className="gap-2 px-3 py-1"
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor: OUTFLOW_SOURCE_COLORS[item.source],
                }}
              />
              <span className="font-medium">{item.label}</span>
              <span>{formatRupiah(item.amount)}</span>
              <span className="text-muted-foreground">
                ({formatPaymentCount(item.count)})
              </span>
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <Card className="p-4" data-testid="cash-flow-stat-skeleton">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <Skeleton className="mt-3 h-8 w-24" />
      <Skeleton className="mt-2 h-4 w-32" />
    </Card>
  );
}

export interface CashFlowSectionProps {
  className?: string;
}

export function CashFlowSection({ className }: CashFlowSectionProps) {
  const defaults = getDefaultDateRange();
  const [period, setPeriod] = useState<TransactionSummaryPeriod>("daily");
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [summary, setSummary] = useState<CashFlowSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await cashFlowSummary({ period, dateFrom, dateTo });
      setSummary(res.data ?? null);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load cash flow summary",
      );
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [period, dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = summary?.totals;
  const buckets = summary?.buckets ?? [];
  const inflowByMethod = summary?.inflow_by_method ?? [];
  const outflowBySource = summary?.outflow_by_source ?? [];
  const productionCost = summary?.production_cost;
  const showProductionCostCard = productionCost != null;
  const showProductionCostSeries = buckets.some(
    (bucket) => bucket.production_cost_amount != null,
  );
  const netAmount = totals?.net_amount;
  const netColor =
    netAmount == null ? "blue" : netAmount >= 0 ? "green" : "red";
  const statCardCount = showProductionCostCard ? 4 : 3;

  return (
    <Card className={cn(className)} data-testid="cash-flow-section">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Cash flow</CardTitle>
            <CardDescription>
              Customer transaction inflows, outflows, and net cash movement
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
              aria-label="Cash flow date from"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full sm:w-40"
            />
            <Input
              type="date"
              aria-label="Cash flow date to"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full sm:w-40"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <>
            <div
              className={cn(
                "grid grid-cols-1 gap-3 sm:grid-cols-2",
                statCardCount === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3",
              )}
            >
              {Array.from({ length: statCardCount }, (_, index) => (
                <StatCardSkeleton key={index} />
              ))}
            </div>
            <Skeleton
              className="h-[280px] w-full rounded-xl"
              data-testid="cash-flow-chart-loading"
            />
          </>
        ) : (
          <>
            <div
              className={cn(
                "grid grid-cols-1 gap-3 sm:grid-cols-2",
                showProductionCostCard ? "lg:grid-cols-4" : "lg:grid-cols-3",
              )}
            >
              <StatCard
                label="Customer transactions"
                value={formatRupiah(totals?.inflow_amount ?? 0)}
                subtitle={
                  totals == null
                    ? undefined
                    : formatTransactionCount(totals.inflow_count)
                }
                icon={ArrowDownLeft}
                color="green"
              />
              <StatCard
                label="Total outflow"
                value={formatRupiah(totals?.outflow_amount ?? 0)}
                subtitle={
                  totals == null
                    ? undefined
                    : formatPaymentCount(totals.outflow_count)
                }
                icon={ArrowUpRight}
                color="amber"
              />
              <StatCard
                label="Net cash flow"
                value={formatRupiah(totals?.net_amount ?? 0)}
                icon={Scale}
                color={netColor}
              />
              {showProductionCostCard && (
                <div
                  className="relative"
                  data-testid="cash-flow-production-cost-card"
                >
                  <StatCard
                    label="Production cost"
                    value={formatRupiah(productionCost.total_estimated_cost)}
                    subtitle={formatCompletedRequestCount(
                      productionCost.completed_request_count,
                    )}
                    icon={Factory}
                    color="purple"
                  />
                  {productionCost.items_without_cogs_count > 0 && (
                    <Badge
                      variant="warning"
                      className="absolute right-3 top-3 gap-1"
                      data-testid="cash-flow-production-cost-warning"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {productionCost.items_without_cogs_count} without COGS
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <InflowMethodLegend items={inflowByMethod} />

            {buckets.length === 0 ? (
              <div className="flex h-[280px] items-center justify-center text-muted-foreground">
                No cash flow data in this period
              </div>
            ) : (
              <div className="h-[280px] w-full" data-testid="cash-flow-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
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
                        value >= 1_000_000
                          ? `${Math.round(value / 1_000_000)}M`
                          : value >= 1_000
                            ? `${Math.round(value / 1_000)}K`
                            : String(value)
                      }
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend />
                    <Bar
                      dataKey="inflow_amount"
                      name="Customer transactions"
                      fill="var(--chart-2)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={32}
                    />
                    <Bar
                      dataKey="outflow_amount"
                      name="Outflow"
                      fill="var(--chart-3)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={32}
                    />
                    {showProductionCostSeries && (
                      <Line
                        type="monotone"
                        dataKey="production_cost_amount"
                        name="Production cost"
                        stroke="var(--chart-4)"
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        dot={false}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            <OutflowBreakdownChart items={outflowBySource} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  FileQuestion,
  Percent,
  UtensilsCrossed,
} from "lucide-react";
import { cogsAdminApi } from "@/lib/api/cogs";
import { ApiError } from "@/lib/api/client";
import type {
  CogsPortfolioCategoryBreakdown,
  CogsPortfolioSummary,
} from "@/lib/api/types";
import { COGS_STATUS_LABELS } from "@/lib/cogs-status";
import { cn, formatDateTime, formatRupiah } from "@/lib/utils";
import { toast } from "sonner";
import { StatCard } from "@/components/dashboard/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";

function formatPercent(value: number) {
  return `${value}%`;
}

function formatMoney(value: number | null | undefined) {
  if (value == null) return "—";
  return formatRupiah(value);
}

function StatCardSkeleton() {
  return (
    <Card className="p-4" data-testid="cogs-summary-stat-skeleton">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <Skeleton className="mt-3 h-8 w-24" />
      <Skeleton className="mt-2 h-4 w-32" />
    </Card>
  );
}

interface CompletenessTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
  }>;
}

function CompletenessTooltip({ active, payload }: CompletenessTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {entry.value ?? 0}
        </p>
      ))}
    </div>
  );
}

const categoryColumns: Column<CogsPortfolioCategoryBreakdown>[] = [
  {
    header: "Category",
    cell: (row) => row.category_name,
  },
  {
    header: "Menus",
    cell: (row) => row.menu_count,
    className: "text-right",
  },
  {
    header: "Complete",
    cell: (row) => row.complete_count,
    className: "text-right",
  },
  {
    header: "Avg margin",
    cell: (row) => formatPercent(row.avg_margin_percent),
    className: "text-right",
  },
  {
    header: "Avg COGS",
    cell: (row) => formatMoney(row.avg_cogs_per_piece),
    className: "text-right",
  },
];

export default function AdminCogsSummaryPage() {
  const [summary, setSummary] = useState<CogsPortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await cogsAdminApi.portfolioSummary();
      setSummary(res.data ?? null);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to load COGS portfolio summary",
      );
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const completenessData = useMemo(() => {
    if (!summary) return [];
    return [
      {
        status: COGS_STATUS_LABELS.complete,
        count: summary.complete_count,
        fill: "var(--chart-2)",
      },
      {
        status: COGS_STATUS_LABELS.missing_prices,
        count: summary.missing_prices_count,
        fill: "var(--chart-3)",
      },
      {
        status: COGS_STATUS_LABELS.no_formula,
        count: summary.no_formula_count,
        fill: "var(--chart-4)",
      },
    ];
  }, [summary]);

  const variance = summary?.variance ?? null;
  const categories = summary?.categories ?? [];
  const hasMenus = (summary?.total_menus ?? 0) > 0;

  return (
    <div className="space-y-6" data-testid="cogs-summary-page">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">COGS Summary</h1>
        <p className="text-muted-foreground">
          Portfolio-level cost of goods sold aggregates across all menus.
          {summary?.generated_at ? (
            <span className="block text-sm">
              Generated {formatDateTime(summary.generated_at)}
            </span>
          ) : null}
        </p>
      </div>

      {loading ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <StatCardSkeleton key={index} />
            ))}
          </div>
          <Skeleton className="h-[280px] w-full rounded-xl" />
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Total menus"
              value={summary?.total_menus ?? 0}
              icon={UtensilsCrossed}
              color="blue"
            />
            <StatCard
              label="Complete COGS"
              value={summary?.complete_count ?? 0}
              icon={CheckCircle2}
              color="green"
            />
            <StatCard
              label="Missing prices"
              value={summary?.missing_prices_count ?? 0}
              icon={AlertTriangle}
              color="amber"
            />
            <StatCard
              label="No formula"
              value={summary?.no_formula_count ?? 0}
              icon={FileQuestion}
              color="purple"
            />
            <StatCard
              label="Average margin"
              value={formatPercent(summary?.avg_margin_percent ?? 0)}
              icon={Percent}
              color="teal"
            />
            <StatCard
              label="Average COGS per piece"
              value={formatMoney(summary?.avg_cogs_per_piece)}
              icon={CircleDollarSign}
              color="blue"
            />
          </div>

          {variance ? (
            <Card data-testid="cogs-summary-variance-card">
              <CardHeader>
                <CardTitle>Sell price variance</CardTitle>
                <CardDescription>
                  Recommended vs current sell price totals across the portfolio
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">Recommended total</p>
                  <p className="text-xl font-semibold">
                    {formatRupiah(variance.total_recommended_sell_price)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current total</p>
                  <p className="text-xl font-semibold">
                    {formatRupiah(variance.total_current_sell_price)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Variance amount</p>
                  <p
                    className={cn(
                      "text-xl font-semibold",
                      variance.variance_amount < 0
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {formatRupiah(variance.variance_amount)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Variance %</p>
                  <p className="text-xl font-semibold">
                    {formatPercent(variance.variance_percent)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card data-testid="cogs-summary-category-table">
            <CardHeader>
              <CardTitle>Category breakdown</CardTitle>
              <CardDescription>
                COGS completeness and averages grouped by menu category
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={categoryColumns}
                rows={categories}
                getRowKey={(row) => row.category_id || row.category_name}
                emptyMessage={
                  hasMenus
                    ? "No category breakdown available."
                    : "No menus yet. Add menus to see COGS summary data."
                }
              />
            </CardContent>
          </Card>

          <Card data-testid="cogs-summary-completeness-chart">
            <CardHeader>
              <CardTitle>COGS completeness</CardTitle>
              <CardDescription>
                Menu counts by COGS calculation status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!hasMenus ? (
                <div className="flex h-[280px] items-center justify-center text-muted-foreground">
                  No menu data to chart
                </div>
              ) : (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={completenessData}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border"
                      />
                      <XAxis
                        dataKey="status"
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        width={32}
                      />
                      <Tooltip content={<CompletenessTooltip />} />
                      <Legend />
                      <Bar
                        dataKey="count"
                        name="Menus"
                        fill="var(--chart-2)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={48}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

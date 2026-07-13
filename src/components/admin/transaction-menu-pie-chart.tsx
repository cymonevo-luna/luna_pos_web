"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { transactionMenuInsights } from "@/lib/api/insights";
import { ApiError } from "@/lib/api/client";
import type { TransactionMenuInsightItem } from "@/lib/api/types";
import { cn, formatRupiah } from "@/lib/utils";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

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

function formatSharePercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

interface PieTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: TransactionMenuInsightItem & { fill?: string };
  }>;
}

function PieTooltip({ active, payload }: PieTooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{item.menu_title}</p>
      <p className="text-muted-foreground">
        Revenue: {formatRupiah(item.revenue)}
      </p>
      <p className="text-muted-foreground">Qty: {item.quantity_sold}</p>
      <p className="font-medium">{formatSharePercent(item.share_percent)}</p>
    </div>
  );
}

const tableColumns: Column<TransactionMenuInsightItem>[] = [
  {
    header: "Menu",
    cell: (row) => row.menu_title,
  },
  {
    header: "Qty sold",
    cell: (row) => row.quantity_sold,
    className: "text-right",
  },
  {
    header: "Revenue",
    cell: (row) => formatRupiah(row.revenue),
    className: "text-right",
  },
  {
    header: "Share",
    cell: (row) => formatSharePercent(row.share_percent),
    className: "text-right",
  },
];

export interface TransactionMenuPieChartProps {
  className?: string;
}

export function TransactionMenuPieChart({
  className,
}: TransactionMenuPieChartProps) {
  const defaults = getDefaultDateRange();
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [menus, setMenus] = useState<TransactionMenuInsightItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await transactionMenuInsights({ dateFrom, dateTo });
      setMenus(res.data?.menus ?? []);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to load transaction menu insights",
      );
      setMenus([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const chartData = useMemo(
    () =>
      menus.map((item, index) => ({
        ...item,
        fill: CHART_COLORS[index % CHART_COLORS.length],
      })),
    [menus],
  );

  return (
    <Card className={cn(className)} data-testid="transaction-menu-insights">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Transaction insights</CardTitle>
            <CardDescription>Revenue share by menu</CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              type="date"
              aria-label="Menu insights date from"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full sm:w-40"
            />
            <Input
              type="date"
              aria-label="Menu insights date to"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full sm:w-40"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <Skeleton
            className="mx-auto h-[280px] max-w-md rounded-full"
            data-testid="menu-pie-chart-loading"
          />
        ) : chartData.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-muted-foreground">
            No menu sales in this period
          </div>
        ) : (
          <div className="h-[280px] w-full" data-testid="menu-pie-chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="revenue"
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
                <Tooltip content={<PieTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        <DataTable
          columns={tableColumns}
          rows={menus}
          getRowKey={(row) => row.menu_id}
          loading={loading}
          emptyMessage="No menu sales in this period"
        />
      </CardContent>
    </Card>
  );
}

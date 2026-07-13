"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { productionNextDayInsight } from "@/lib/api/insights";
import { ApiError } from "@/lib/api/client";
import type {
  ProductionInsightConfidence,
  ProductionNextDayInsightItem,
} from "@/lib/api/types";
import { cn, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const LOOKBACK_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "21", label: "21 days" },
  { value: "30", label: "30 days" },
];

function confidenceBadgeVariant(
  confidence: ProductionInsightConfidence,
): "default" | "secondary" | "outline" {
  switch (confidence) {
    case "high":
      return "default";
    case "medium":
      return "secondary";
    case "low":
      return "outline";
  }
}

function formatConfidence(confidence: ProductionInsightConfidence): string {
  return confidence.charAt(0).toUpperCase() + confidence.slice(1);
}

function formatDecimal(value: number | null | undefined, digits = 1): string {
  const n = Number(value);
  return (Number.isFinite(n) ? n : 0).toFixed(digits);
}

const tableColumns: Column<ProductionNextDayInsightItem>[] = [
  {
    header: "Menu",
    cell: (row) => row.menu_title,
  },
  {
    header: "Current stock",
    cell: (row) => row.current_stock,
    className: "text-right",
  },
  {
    header: "Avg daily sales",
    cell: (row) => formatDecimal(row.avg_daily_sales),
    className: "text-right",
  },
  {
    header: "Projected demand",
    cell: (row) => formatDecimal(row.projected_demand),
    className: "text-right",
  },
  {
    header: "Recommended production",
    cell: (row) => (
      <span
        className={cn(
          row.recommended_production_qty > 0 && "font-semibold text-primary",
        )}
      >
        {row.recommended_production_qty}
      </span>
    ),
    className: "text-right",
  },
  {
    header: "Max producible",
    cell: (row) =>
      row.max_producible == null ? "—" : row.max_producible,
    className: "text-right",
  },
  {
    header: "Confidence",
    cell: (row) => (
      <Badge variant={confidenceBadgeVariant(row.confidence)}>
        {formatConfidence(row.confidence)}
      </Badge>
    ),
  },
  {
    header: "Ingredients",
    cell: (row) =>
      row.limited_by_ingredients ? (
        <Badge variant="outline" title={row.limiting_ingredient_title ?? undefined}>
          Limited
        </Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
];

export interface ProductionInsightPanelProps {
  className?: string;
}

export function ProductionInsightPanel({
  className,
}: ProductionInsightPanelProps) {
  const [lookbackDays, setLookbackDays] = useState("14");
  const [items, setItems] = useState<ProductionNextDayInsightItem[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productionNextDayInsight({
        lookbackDays: Number(lookbackDays),
      });
      setItems(res.data?.items ?? []);
      setGeneratedAt(res.data?.generated_at ?? null);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to load production insights",
      );
      setItems([]);
      setGeneratedAt(null);
    } finally {
      setLoading(false);
    }
  }, [lookbackDays]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card className={cn(className)} data-testid="production-insight-panel">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Production insight</CardTitle>
            <CardDescription>
              Next-day production recommendations based on recent sales
            </CardDescription>
            {generatedAt && !loading && (
              <p className="mt-1 text-xs text-muted-foreground">
                Generated {formatDateTime(generatedAt)}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select
              aria-label="Lookback days"
              value={lookbackDays}
              onChange={(e) => setLookbackDays(e.target.value)}
              className="w-full sm:w-40"
              options={LOOKBACK_OPTIONS}
            />
            <Link
              href="/admin/production-requests/new"
              className={buttonVariants({ size: "sm" })}
            >
              <Plus className="h-4 w-4" />
              New production request
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={tableColumns}
          rows={items}
          getRowKey={(row) => row.menu_id}
          loading={loading}
          emptyMessage="No production recommendations available"
          getRowClassName={(row) =>
            row.recommended_production_qty > 0
              ? "bg-primary/5 hover:bg-primary/10"
              : undefined
          }
        />
      </CardContent>
    </Card>
  );
}

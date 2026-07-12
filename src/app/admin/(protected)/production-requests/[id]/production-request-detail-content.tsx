"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { productionRequestsAdminApi } from "@/lib/api/production-requests";
import { ApiError } from "@/lib/api/client";
import type {
  ProductionRequest,
  ProductionRequestStatus,
  ProductionRequestStatusHistoryEntry,
} from "@/lib/api/types";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProductionAggregatedIngredientsTable } from "@/components/admin/production-aggregated-ingredients-table";
import { ProductionLineStockEstimation } from "@/components/admin/production-line-stock-estimation";

function productionStatusBadgeVariant(
  status: ProductionRequestStatus,
): NonNullable<BadgeProps["variant"]> {
  switch (status) {
    case "REQUESTED":
      return "default";
    case "ACCEPTED":
    case "READY_TO_PICK":
      return "warning";
    case "DONE":
      return "success";
    default:
      return "secondary";
  }
}

function formatStatusHistoryLabel(entry: ProductionRequestStatusHistoryEntry) {
  if (entry.from_status?.trim()) {
    return `${entry.from_status} → ${entry.to_status}`;
  }
  return entry.to_status;
}

export function ProductionRequestDetailContent({ id }: { id: string }) {
  const [request, setRequest] = useState<ProductionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await productionRequestsAdminApi.get(id);
      setRequest(result.data);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to load production request";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const statusHistory = useMemo(() => {
    if (!request) return [];
    return [...request.status_history].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }, [request]);

  return (
    <div className="max-w-4xl space-y-6">
      <Link
        href="/admin/production-requests"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to production requests
      </Link>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-48 w-full" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : request ? (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Production request</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-mono">{request.id}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={productionStatusBadgeVariant(request.status)}
                data-testid="production-request-status-badge"
              >
                {request.status}
              </Badge>
              <Badge
                variant={request.is_fully_producible ? "success" : "warning"}
                data-testid="production-request-producibility-badge"
              >
                {request.is_fully_producible
                  ? "Fully producible"
                  : "Insufficient stock"}
              </Badge>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Created by</CardDescription>
                <CardTitle className="text-xl">
                  {request.created_by_username?.trim() || "—"}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Created at</CardDescription>
                <CardTitle className="text-xl">
                  {formatDateTime(request.created_at)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Updated at</CardDescription>
                <CardTitle className="text-xl">
                  {formatDateTime(request.updated_at)}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {request.notes?.trim() ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{request.notes}</p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Line items</CardTitle>
              <CardDescription>
                {request.items.length} item
                {request.items.length === 1 ? "" : "s"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {request.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No line items</p>
              ) : (
                request.items.map((item) => (
                  <div
                    key={item.id}
                    className="space-y-3 rounded-xl border border-border p-4"
                    data-testid={`production-request-line-item-${item.id}`}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-medium">{item.menu_title}</p>
                      <p className="text-muted-foreground text-sm">
                        Qty: <span className="font-medium">{item.quantity}</span>
                      </p>
                    </div>
                    <ProductionLineStockEstimation item={item} showHeader={false} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {request.aggregated_ingredients.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Aggregated ingredients</CardTitle>
                <CardDescription>
                  Combined ingredient requirements across all line items.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProductionAggregatedIngredientsTable
                  ingredients={request.aggregated_ingredients}
                />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status history</CardTitle>
              <CardDescription>
                Chronological record of status changes for this production request.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statusHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No status history yet
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {statusHistory.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="space-y-1">
                        <Badge
                          variant={productionStatusBadgeVariant(entry.to_status)}
                        >
                          {formatStatusHistoryLabel(entry)}
                        </Badge>
                        <p className="text-sm text-muted-foreground">
                          {entry.changed_by_username}
                        </p>
                      </div>
                      <time
                        className="text-sm text-muted-foreground"
                        dateTime={entry.created_at}
                      >
                        {formatDateTime(entry.created_at)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

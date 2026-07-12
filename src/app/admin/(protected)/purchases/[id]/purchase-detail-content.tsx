"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { purchaseRequestsAdminApi } from "@/lib/api/purchase-requests";
import { ApiError } from "@/lib/api/client";
import type {
  PurchaseRequest,
  PurchaseRequestStatus,
} from "@/lib/api/types";
import {
  formatDate,
  formatDateTime,
  formatRupiah,
  formatStockQuantity,
} from "@/lib/utils";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function purchaseStatusBadgeVariant(
  status: PurchaseRequestStatus,
): NonNullable<BadgeProps["variant"]> {
  switch (status) {
    case "PENDING":
      return "secondary";
    case "REQUESTED":
      return "default";
    case "PAID":
      return "warning";
    case "DELIVERED":
      return "success";
    default:
      return "secondary";
  }
}

export function AdminPurchaseDetailContent({ id }: { id: string }) {
  const [purchase, setPurchase] = useState<PurchaseRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    purchaseRequestsAdminApi
      .get(id)
      .then((res) => setPurchase(res.data ?? null))
      .catch((err) => {
        const message =
          err instanceof ApiError
            ? err.message
            : "Failed to load purchase request";
        setError(message);
        toast.error(message);
      })
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="max-w-4xl space-y-6">
      <Link
        href="/admin/purchases"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to purchases
      </Link>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
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
      ) : purchase ? (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-mono text-sm text-muted-foreground">
                {purchase.id}
              </h2>
              <p className="text-2xl font-semibold">{purchase.supplier_name}</p>
              <p className="text-sm text-muted-foreground">
                {purchase.supplier_contact_info}
              </p>
            </div>
            <Badge variant={purchaseStatusBadgeVariant(purchase.status)}>
              {purchase.status}
            </Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total estimate</CardDescription>
                <CardTitle className="text-xl">
                  {formatRupiah(purchase.total_amount)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Created</CardDescription>
                <CardTitle className="text-xl">
                  {formatDateTime(purchase.created_at)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Updated</CardDescription>
                <CardTitle className="text-xl">
                  {formatDate(purchase.updated_at)}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {purchase.notes?.trim() ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{purchase.notes}</p>
              </CardContent>
            </Card>
          ) : null}

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">Line items</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Food supply</th>
                    <th className="px-4 py-3 font-medium">Quantity</th>
                    <th className="px-4 py-3 font-medium">Unit price</th>
                    <th className="px-4 py-3 font-medium">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {purchase.items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-10 text-center text-muted-foreground"
                      >
                        No line items.
                      </td>
                    </tr>
                  ) : (
                    purchase.items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-4 py-3 font-medium">
                          {item.food_supply_title ?? "Unknown"}
                        </td>
                        <td className="px-4 py-3">
                          {item.unit
                            ? formatStockQuantity(item.quantity, item.unit)
                            : item.quantity}
                        </td>
                        <td className="px-4 py-3">
                          {formatRupiah(item.unit_price)}
                        </td>
                        <td className="px-4 py-3">
                          {formatRupiah(item.price_amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}

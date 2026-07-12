"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { purchaseRequestsAdminApi } from "@/lib/api/purchase-requests";
import { ApiError } from "@/lib/api/client";
import type {
  PurchaseRequest,
  PurchaseRequestItem,
  PurchaseRequestStatus,
  PurchaseRequestStatusHistoryEntry,
} from "@/lib/api/types";
import {
  buildPurchaseWhatsAppMessage,
  extractWhatsAppPhone,
  formatDateTime,
  formatRupiah,
  formatStockQuantity,
  formatSupplierUnitPrice,
  menuPhotoUrl,
} from "@/lib/utils";
import { toast } from "sonner";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STATUS_OPTIONS: { value: PurchaseRequestStatus; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "REQUESTED", label: "Requested" },
  { value: "PAID", label: "Paid" },
  { value: "DELIVERED", label: "Delivered" },
];

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

function displayItemUnitPrice(item: PurchaseRequestItem) {
  const unit = item.unit ?? "";
  if (item.unit_price != null && Number.isFinite(item.unit_price)) {
    const formatted = Number.parseFloat(item.unit_price.toFixed(4)).toString();
    return `${formatRupiah(Number.parseFloat(formatted))} / ${unit}`;
  }
  return formatSupplierUnitPrice(
    item.price_amount,
    item.price_quantity,
    unit || "unit",
  );
}

function formatStatusHistoryLabel(entry: PurchaseRequestStatusHistoryEntry) {
  if (entry.from_status?.trim()) {
    return `${entry.from_status} → ${entry.to_status}`;
  }
  return entry.to_status;
}

function statusHistoryPhotoAltText(toStatus: string) {
  if (toStatus === "PAID") return "Receipt photo";
  if (toStatus === "DELIVERED") return "Package photo";
  return "Status photo";
}

export function AdminPurchaseDetailContent({ id }: { id: string }) {
  const [purchase, setPurchase] = useState<PurchaseRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await purchaseRequestsAdminApi.get(id);
      setPurchase(res.data);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load purchase request",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleStatusChange = async (status: PurchaseRequestStatus) => {
    if (!purchase || status === purchase.status) return;
    setSavingStatus(true);
    try {
      const res = await purchaseRequestsAdminApi.updateStatus(id, status);
      setPurchase(res.data);
      toast.success("Status updated");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to update status",
      );
    } finally {
      setSavingStatus(false);
    }
  };

  const whatsAppPhone = purchase
    ? extractWhatsAppPhone(purchase.supplier_contact_info)
    : null;

  const handleContactSupplier = () => {
    if (!purchase || !whatsAppPhone) return;
    const message = buildPurchaseWhatsAppMessage(purchase);
    const url = `https://wa.me/${whatsAppPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

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
      ) : purchase ? (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">{purchase.supplier_name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Purchase request ·{" "}
                <span className="font-mono">{purchase.id}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {purchase.supplier_contact_info ? (
                <span title={whatsAppPhone ? undefined : "No WhatsApp number in contact info"}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!whatsAppPhone}
                    onClick={handleContactSupplier}
                    aria-label="Contact supplier"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Contact supplier
                  </Button>
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Status</CardDescription>
                <CardTitle className="text-xl">
                  <Badge variant={purchaseStatusBadgeVariant(purchase.status)}>
                    {purchase.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total estimate</CardDescription>
                <CardTitle className="text-xl">
                  {formatRupiah(purchase.total_estimated_amount)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Created at</CardDescription>
                <CardTitle className="text-xl">
                  {formatDateTime(purchase.created_at)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Created by</CardDescription>
                <CardTitle className="text-xl">
                  {purchase.created_by_username?.trim() || "—"}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Update status</CardTitle>
              <CardDescription>
                Change the purchase request lifecycle status.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                aria-label="Purchase request status"
                className="max-w-xs"
                options={STATUS_OPTIONS}
                value={purchase.status}
                disabled={savingStatus}
                onChange={(event) =>
                  void handleStatusChange(
                    event.target.value as PurchaseRequestStatus,
                  )
                }
              />
            </CardContent>
          </Card>

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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status History</CardTitle>
              <CardDescription>
                Chronological record of status changes for this purchase request.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {purchase.status_history.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No status history yet
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {purchase.status_history.map((entry) => {
                    const resolvedPhotoUrl = entry.photo_url?.trim()
                      ? menuPhotoUrl(entry.photo_url)
                      : null;

                    return (
                      <li
                        key={entry.id}
                        className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant={purchaseStatusBadgeVariant(
                                entry.to_status as PurchaseRequestStatus,
                              )}
                            >
                              {formatStatusHistoryLabel(entry)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {entry.changed_by_username}
                          </p>
                        </div>
                        <div className="flex flex-col items-start gap-2 sm:items-end">
                          <time
                            className="text-sm text-muted-foreground"
                            dateTime={entry.created_at}
                          >
                            {formatDateTime(entry.created_at)}
                          </time>
                          {resolvedPhotoUrl ? (
                            <a
                              href={resolvedPhotoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block overflow-hidden rounded-md border border-border"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={resolvedPhotoUrl}
                                alt={statusHistoryPhotoAltText(entry.to_status)}
                                className="h-20 w-20 object-cover"
                              />
                            </a>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">Line items</CardTitle>
              <CardDescription>
                {purchase.items.length} item
                {purchase.items.length === 1 ? "" : "s"}
              </CardDescription>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Food supply</th>
                    <th className="px-4 py-3 font-medium">Quantity</th>
                    <th className="px-4 py-3 font-medium">Unit price</th>
                    <th className="px-4 py-3 font-medium">Line estimate</th>
                  </tr>
                </thead>
                <tbody>
                  {purchase.items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-4 py-3 font-medium">
                        {item.food_supply_title ?? "Unknown"}
                      </td>
                      <td className="px-4 py-3">
                        {formatStockQuantity(item.quantity, item.unit ?? "unit")}
                      </td>
                      <td className="px-4 py-3">{displayItemUnitPrice(item)}</td>
                      <td className="px-4 py-3">
                        {formatRupiah(item.line_estimated_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-border bg-muted/30">
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-3 text-right font-medium"
                    >
                      Total estimate
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {formatRupiah(purchase.total_estimated_amount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, MessageCircle, Upload } from "lucide-react";
import {
  purchaseRequestsAdminApi,
  type UpdatePurchaseStatusPayload,
} from "@/lib/api/purchase-requests";
import { ApiError } from "@/lib/api/client";
import { uploadPurchasePhoto, validateMenuPhotoFile } from "@/lib/api/uploads";
import type {
  PurchaseRequest,
  PurchaseRequestItem,
  PurchaseRequestStatus,
} from "@/lib/api/types";
import {
  buildPurchaseWhatsAppMessage,
  extractWhatsAppPhone,
  formatDateTime,
  formatRupiah,
  formatStockQuantity,
  formatSupplierUnitPrice,
} from "@/lib/utils";
import { toast } from "sonner";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

const NEXT_STATUS: Record<
  PurchaseRequestStatus,
  PurchaseRequestStatus | null
> = {
  PENDING: "REQUESTED",
  REQUESTED: "PAID",
  PAID: "DELIVERED",
  DELIVERED: null,
};

const STATUS_ACTION_LABELS: Record<PurchaseRequestStatus, string> = {
  PENDING: "Mark as Requested",
  REQUESTED: "Mark as Paid",
  PAID: "Mark as Delivered",
  DELIVERED: "",
};

const PHOTO_PROMPTS: Partial<
  Record<
    PurchaseRequestStatus,
    { modalTitle: string; inputLabel: string }
  >
> = {
  PAID: {
    modalTitle: "Photo of the Receipt",
    inputLabel: "Receipt photo",
  },
  DELIVERED: {
    modalTitle: "Photo of the Package",
    inputLabel: "Package photo",
  },
};

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

function getNextStatus(
  status: PurchaseRequestStatus,
): PurchaseRequestStatus | null {
  return NEXT_STATUS[status];
}

function statusRequiresPhoto(status: PurchaseRequestStatus): boolean {
  return status === "PAID" || status === "DELIVERED";
}

export function AdminPurchaseDetailContent({ id }: { id: string }) {
  const [purchase, setPurchase] = useState<PurchaseRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [advancingStatus, setAdvancingStatus] = useState(false);
  const [statusActionError, setStatusActionError] = useState<string | null>(
    null,
  );
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [pendingStatus, setPendingStatus] =
    useState<PurchaseRequestStatus | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoValidationError, setPhotoValidationError] = useState<
    string | null
  >(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!selectedPhoto) {
      setPhotoPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(selectedPhoto);
    setPhotoPreviewUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedPhoto]);

  const resetPhotoModal = () => {
    setPhotoModalOpen(false);
    setPendingStatus(null);
    setSelectedPhoto(null);
    setPhotoValidationError(null);
    setStatusActionError(null);
  };

  const applyStatusUpdate = async (
    status: PurchaseRequestStatus,
    photoUrl?: string,
  ) => {
    const payload: UpdatePurchaseStatusPayload = { status };
    if (photoUrl) {
      payload.photo_url = photoUrl;
    }

    setAdvancingStatus(true);
    setStatusActionError(null);
    try {
      await purchaseRequestsAdminApi.updateStatus(id, payload);
      await load();
      toast.success("Status updated");
      resetPhotoModal();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to update status";
      setStatusActionError(message);
      if (!photoModalOpen) {
        toast.error(message);
      }
    } finally {
      setAdvancingStatus(false);
    }
  };

  const handleAdvanceStatusClick = () => {
    if (!purchase) return;
    const nextStatus = getNextStatus(purchase.status);
    if (!nextStatus) return;

    setStatusActionError(null);

    if (statusRequiresPhoto(nextStatus)) {
      setPendingStatus(nextStatus);
      setSelectedPhoto(null);
      setPhotoValidationError(null);
      setPhotoModalOpen(true);
      return;
    }

    void applyStatusUpdate(nextStatus);
  };

  const handlePhotoSelected = (file: File | undefined) => {
    if (!file) return;

    const validationError = validateMenuPhotoFile(file);
    if (validationError) {
      setPhotoValidationError(validationError);
      setSelectedPhoto(null);
      return;
    }

    setPhotoValidationError(null);
    setSelectedPhoto(file);
    setStatusActionError(null);
  };

  const handlePhotoInputChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    handlePhotoSelected(file);
  };

  const handlePhotoConfirm = async () => {
    if (!pendingStatus) return;

    if (!selectedPhoto) {
      setPhotoValidationError("A photo is required before confirming.");
      return;
    }

    setAdvancingStatus(true);
    setStatusActionError(null);
    setPhotoValidationError(null);
    try {
      const uploadResult = await uploadPurchasePhoto(selectedPhoto);
      await applyStatusUpdate(pendingStatus, uploadResult.url);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to upload photo";
      if (err instanceof ApiError && err.status === 422) {
        setStatusActionError(message);
      } else if (err instanceof ApiError && err.fields) {
        const fieldMessages = Object.values(err.fields).join(" ");
        setStatusActionError(fieldMessages || message);
      } else {
        setPhotoValidationError(message);
      }
      setAdvancingStatus(false);
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

  const nextStatus = purchase ? getNextStatus(purchase.status) : null;
  const statusActionLabel = purchase
    ? STATUS_ACTION_LABELS[purchase.status]
    : "";
  const photoPrompt = pendingStatus ? PHOTO_PROMPTS[pendingStatus] : null;

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
            <Card data-testid="purchase-status-card">
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

          {nextStatus ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Update status</CardTitle>
                <CardDescription>
                  Advance the purchase request to the next lifecycle step.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={handleAdvanceStatusClick}
                  isLoading={advancingStatus && !photoModalOpen}
                  disabled={advancingStatus}
                  aria-label={statusActionLabel}
                >
                  {statusActionLabel}
                </Button>
                {statusActionError && !photoModalOpen ? (
                  <p className="text-sm text-destructive" role="alert">
                    {statusActionError}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status history</CardTitle>
              <CardDescription>
                Lifecycle changes recorded for this purchase request.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {purchase.status_history && purchase.status_history.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Changed at</th>
                        <th className="px-4 py-3 font-medium">Changed by</th>
                        <th className="px-4 py-3 font-medium">Photo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchase.status_history.map((entry) => (
                        <tr
                          key={entry.id}
                          className="border-b border-border last:border-0"
                        >
                          <td className="px-4 py-3">
                            <Badge
                              variant={purchaseStatusBadgeVariant(entry.status)}
                            >
                              {entry.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {formatDateTime(entry.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            {entry.created_by_username?.trim() || "—"}
                          </td>
                          <td className="px-4 py-3">
                            {entry.photo_url?.trim() ? (
                              <a
                                href={entry.photo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline-offset-4 hover:underline"
                              >
                                View photo
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No status changes recorded yet.
                </p>
              )}
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

          <Dialog open={photoModalOpen} onClose={resetPhotoModal}>
            <DialogTitle>{photoPrompt?.modalTitle ?? "Upload photo"}</DialogTitle>
            <DialogDescription>
              Upload or capture a photo before confirming this status change.
            </DialogDescription>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {photoPrompt?.inputLabel ?? "Photo"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={uploadInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    data-testid="purchase-photo-upload-input"
                    onChange={handlePhotoInputChange}
                    disabled={advancingStatus}
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    data-testid="purchase-photo-camera-input"
                    onChange={handlePhotoInputChange}
                    disabled={advancingStatus}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={advancingStatus}
                    onClick={() => uploadInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    Upload file
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={advancingStatus}
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <Camera className="h-4 w-4" />
                    Take photo
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  JPEG, PNG, or WebP up to 5 MB.
                </p>
              </div>

              {photoPreviewUrl ? (
                <div
                  className="flex aspect-video w-full max-w-sm items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30"
                  data-testid="purchase-photo-preview"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoPreviewUrl}
                    alt="Selected proof photo preview"
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : null}

              {photoValidationError ? (
                <p className="text-sm text-destructive" role="alert">
                  {photoValidationError}
                </p>
              ) : null}
              {statusActionError ? (
                <p className="text-sm text-destructive" role="alert">
                  {statusActionError}
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={resetPhotoModal}
                disabled={advancingStatus}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handlePhotoConfirm()}
                isLoading={advancingStatus}
                disabled={advancingStatus || !selectedPhoto}
              >
                Confirm
              </Button>
            </DialogFooter>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}

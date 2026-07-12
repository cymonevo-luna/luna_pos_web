"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import {
  suppliersAdminApi,
  supplierPriceFormToPayload,
} from "@/lib/api/suppliers";
import { ApiError } from "@/lib/api/client";
import type { Supplier, SupplierPrice } from "@/lib/api/types";
import type { SupplierPriceFormValues } from "@/lib/validations";
import {
  formatDate,
  formatRupiah,
  formatStockQuantity,
  formatSupplierUnitPrice,
} from "@/lib/utils";
import { toast } from "sonner";
import {
  SupplierPriceForm,
  type SupplierPriceFormHandle,
} from "@/components/admin/supplier-price-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PriceDialogState =
  | { mode: "create" }
  | { mode: "edit"; price: SupplierPrice }
  | null;

function priceToFormValues(
  price: SupplierPrice,
): Partial<SupplierPriceFormValues> {
  return {
    food_supply_id: price.food_supply_id,
    price_amount: price.price_amount,
    price_quantity: price.price_quantity,
  };
}

function priceToSelectedSupply(price: SupplierPrice) {
  return {
    id: price.food_supply_id,
    title: price.food_supply_title ?? "Unknown",
    unit: price.unit,
    stock_quantity: 0,
  };
}

function displayUnitPrice(price: SupplierPrice) {
  if (price.unit_price != null && Number.isFinite(price.unit_price)) {
    const formatted = Number.parseFloat(price.unit_price.toFixed(4)).toString();
    return `${formatRupiah(Number.parseFloat(formatted))} / ${price.unit}`;
  }
  return formatSupplierUnitPrice(
    price.price_amount,
    price.price_quantity,
    price.unit,
  );
}

export function AdminSupplierDetailContent({ id }: { id: string }) {
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [priceDialog, setPriceDialog] = useState<PriceDialogState>(null);
  const [savingPrice, setSavingPrice] = useState(false);
  const [pendingDeletePrice, setPendingDeletePrice] =
    useState<SupplierPrice | null>(null);
  const [deletingPrice, setDeletingPrice] = useState(false);
  const priceFormRef = useRef<SupplierPriceFormHandle>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await suppliersAdminApi.get(id);
      setSupplier(res.data);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load supplier",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const closePriceDialog = () => {
    if (savingPrice) return;
    setPriceDialog(null);
  };

  const handlePriceSubmit = async (values: SupplierPriceFormValues) => {
    if (!priceDialog) return;
    setSavingPrice(true);
    try {
      const payload = supplierPriceFormToPayload(values);
      if (priceDialog.mode === "create") {
        await suppliersAdminApi.createPrice(id, payload);
        toast.success("Price quote added");
      } else {
        await suppliersAdminApi.updatePrice(priceDialog.price.id, payload);
        toast.success("Price quote updated");
      }
      setPriceDialog(null);
      void load();
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        priceFormRef.current?.applyServerErrors(err.fields);
      }
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save price quote",
      );
    } finally {
      setSavingPrice(false);
    }
  };

  const handleDeletePrice = async () => {
    if (!pendingDeletePrice) return;
    setDeletingPrice(true);
    try {
      await suppliersAdminApi.deletePrice(pendingDeletePrice.id);
      toast.success("Price quote deleted");
      setPendingDeletePrice(null);
      void load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete price quote",
      );
    } finally {
      setDeletingPrice(false);
    }
  };

  const priceDialogTitle =
    priceDialog?.mode === "edit" ? "Edit price quote" : "Add price quote";

  const priceFormDefaults =
    priceDialog?.mode === "edit"
      ? priceToFormValues(priceDialog.price)
      : undefined;

  const priceSelectedSupply =
    priceDialog?.mode === "edit"
      ? priceToSelectedSupply(priceDialog.price)
      : null;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/suppliers"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to suppliers
      </Link>

      {loading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : supplier ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>{supplier.name}</CardTitle>
                  <CardDescription className="mt-1">
                    {supplier.phone_number} · {supplier.address}
                  </CardDescription>
                </div>
                <Link
                  href={`/admin/suppliers/${supplier.id}/edit`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <Pencil className="h-4 w-4" />
                  Edit supplier
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-border">
                {[
                  ["Delivery", supplier.supports_delivery ? "Yes" : "No"],
                  [
                    "Delivery cost",
                    supplier.supports_delivery && supplier.delivery_cost != null
                      ? formatRupiah(supplier.delivery_cost)
                      : "—",
                  ],
                  ["Updated", formatDate(supplier.updated_at)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-4 py-3 text-sm"
                  >
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-medium">
                      {label === "Delivery" ? (
                        <Badge
                          variant={
                            supplier.supports_delivery ? "success" : "secondary"
                          }
                        >
                          {value}
                        </Badge>
                      ) : (
                        value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-semibold">Price quotes</h3>
              <p className="text-muted-foreground text-sm">
                {supplier.price_quotes.length} quote
                {supplier.price_quotes.length === 1 ? "" : "s"}
              </p>
            </div>
            <Button onClick={() => setPriceDialog({ mode: "create" })}>
              <Plus className="h-4 w-4" />
              Add price
            </Button>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Food supply</th>
                    <th className="px-4 py-3 font-medium">Unit</th>
                    <th className="px-4 py-3 font-medium">Price amount</th>
                    <th className="px-4 py-3 font-medium">Price quantity</th>
                    <th className="px-4 py-3 font-medium">Unit price</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {supplier.price_quotes.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-muted-foreground"
                      >
                        No price quotes yet.
                      </td>
                    </tr>
                  ) : (
                    supplier.price_quotes.map((price) => (
                      <tr
                        key={price.id}
                        className="border-b border-border last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-4 py-3 font-medium">
                          {price.food_supply_title ?? "Unknown"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {price.unit}
                        </td>
                        <td className="px-4 py-3">
                          {formatRupiah(price.price_amount)}
                        </td>
                        <td className="px-4 py-3">
                          {formatStockQuantity(
                            price.price_quantity,
                            price.unit,
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {displayUnitPrice(price)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label="Edit price quote"
                              onClick={() =>
                                setPriceDialog({ mode: "edit", price })
                              }
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              aria-label="Delete price quote"
                              onClick={() => setPendingDeletePrice(price)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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

      <Dialog
        open={priceDialog !== null}
        onClose={closePriceDialog}
        className="max-w-lg"
      >
        <DialogTitle>{priceDialogTitle}</DialogTitle>
        {priceDialog && (
          <SupplierPriceForm
            key={
              priceDialog.mode === "edit"
                ? `edit-${priceDialog.price.id}`
                : "create"
            }
            ref={priceFormRef}
            defaultValues={priceFormDefaults}
            selectedSupply={priceSelectedSupply}
            onSubmit={handlePriceSubmit}
            onCancel={closePriceDialog}
            isLoading={savingPrice}
            submitLabel={
              priceDialog.mode === "edit" ? "Save changes" : "Add price"
            }
          />
        )}
      </Dialog>

      {pendingDeletePrice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold">Delete price quote</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to delete the price quote for{" "}
              <span className="font-medium text-foreground">
                {pendingDeletePrice.food_supply_title ?? "this food supply"}
              </span>
              ?
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setPendingDeletePrice(null)}
                disabled={deletingPrice}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeletePrice}
                isLoading={deletingPrice}
              >
                Delete
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

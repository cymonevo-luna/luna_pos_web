"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
} from "lucide-react";
import {
  suppliersAdminApi,
  supplierFormToPayload,
} from "@/lib/api/suppliers";
import { ApiError } from "@/lib/api/client";
import type { Supplier, SupplierFoodItem } from "@/lib/api/types";
import type { SupplierFormValues } from "@/lib/validations";
import { formatDate, formatRupiah } from "@/lib/utils";
import { toast } from "sonner";
import {
  SupplierForm,
  type SupplierFormHandle,
} from "@/components/admin/supplier-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

const PER_PAGE = 10;

type SupplierDialogState =
  | { mode: "create" }
  | { mode: "edit"; supplier: Supplier }
  | null;

function supplierToFormValues(
  supplier: Supplier,
): Partial<SupplierFormValues> {
  return {
    name: supplier.name,
    phone_number: supplier.phone_number,
    address: supplier.address,
    supports_delivery: supplier.supports_delivery,
    delivery_cost: supplier.delivery_cost ?? undefined,
    food_items: supplier.food_items.map((item) => ({
      food_supply_id: item.food_supply_id,
      price: item.price,
      quantity: item.quantity,
      unit: item.unit,
    })),
  };
}

function formatFoodItemLine(item: SupplierFoodItem) {
  const title = item.food_supply_title ?? "Unknown";
  return `${title} — ${formatRupiah(item.price)} / ${item.quantity} ${item.unit}`;
}

function formatFoodItemsPreview(items: SupplierFoodItem[]) {
  if (items.length === 0) return "";
  const first = formatFoodItemLine(items[0]);
  if (items.length === 1) return first;
  return `${first} +${items.length - 1} more`;
}

export default function AdminSuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dialog, setDialog] = useState<SupplierDialogState>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<SupplierFormHandle>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await suppliersAdminApi.list({
        page,
        perPage: PER_PAGE,
        search: debounced,
      });
      setSuppliers(res.data ?? []);
      setTotal(res.meta?.total ?? 0);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load suppliers",
      );
    } finally {
      setLoading(false);
    }
  }, [page, debounced]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await suppliersAdminApi.delete(pendingDelete.id);
      toast.success("Supplier deleted");
      setPendingDelete(null);
      void load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete supplier",
      );
    } finally {
      setDeleting(false);
    }
  };

  const closeDialog = () => {
    if (saving) return;
    setDialog(null);
  };

  const handleFormSubmit = async (values: SupplierFormValues) => {
    if (!dialog) return;
    setSaving(true);
    try {
      const payload = supplierFormToPayload(values);
      if (dialog.mode === "create") {
        await suppliersAdminApi.create(payload);
        toast.success("Supplier created");
      } else {
        await suppliersAdminApi.update(dialog.supplier.id, payload);
        toast.success("Supplier updated");
      }
      setDialog(null);
      void load();
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        formRef.current?.applyServerErrors(err.fields);
      }
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save supplier",
      );
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const dialogTitle =
    dialog?.mode === "edit" ? "Edit supplier" : "Add supplier";

  const formDefaultValues =
    dialog?.mode === "edit"
      ? supplierToFormValues(dialog.supplier)
      : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Suppliers</h2>
          <p className="text-muted-foreground">{total} total</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name, phone, or address"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => setDialog({ mode: "create" })}>
            <Plus className="h-4 w-4" />
            Add supplier
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Address</th>
                <th className="px-4 py-3 font-medium">Delivery</th>
                <th className="px-4 py-3 font-medium">Food items</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-destructive"
                  >
                    {error}
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No suppliers found.
                  </td>
                </tr>
              ) : (
                suppliers.map((supplier) => {
                  const foodPreview = formatFoodItemsPreview(
                    supplier.food_items,
                  );
                  return (
                    <tr
                      key={supplier.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 font-medium">
                        {supplier.name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {supplier.phone_number}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-muted-foreground">
                        <span className="line-clamp-2">{supplier.address}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            supplier.supports_delivery ? "success" : "secondary"
                          }
                        >
                          {supplier.supports_delivery ? "Yes" : "No"}
                        </Badge>
                        {supplier.supports_delivery &&
                          supplier.delivery_cost != null && (
                            <p className="text-muted-foreground mt-1 text-xs">
                              {formatRupiah(supplier.delivery_cost)}
                            </p>
                          )}
                      </td>
                      <td
                        className="px-4 py-3"
                        title={foodPreview || undefined}
                      >
                        <span className="font-medium">
                          {supplier.food_items.length}
                        </span>
                        {foodPreview && (
                          <p className="text-muted-foreground mt-0.5 max-w-[220px] truncate text-xs">
                            {foodPreview}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(supplier.updated_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label="Edit supplier"
                            onClick={() =>
                              setDialog({ mode: "edit", supplier })
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            aria-label="Delete supplier"
                            onClick={() => setPendingDelete(supplier)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={dialog !== null} onClose={closeDialog} className="max-w-3xl">
        <DialogTitle>{dialogTitle}</DialogTitle>
        {dialog && (
          <SupplierForm
            key={
              dialog.mode === "edit"
                ? `edit-${dialog.supplier.id}`
                : "create"
            }
            ref={formRef}
            defaultValues={formDefaultValues}
            onSubmit={handleFormSubmit}
            onCancel={closeDialog}
            isLoading={saving}
            submitLabel={
              dialog.mode === "edit" ? "Save changes" : "Add supplier"
            }
          />
        )}
      </Dialog>

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold">Delete supplier</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {pendingDelete.name}
              </span>
              ? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                isLoading={deleting}
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

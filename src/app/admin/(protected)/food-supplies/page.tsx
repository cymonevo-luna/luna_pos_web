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
  foodSuppliesAdminApi,
  foodSupplyFormToPayload,
  type FoodSupplySortBy,
  type FoodSupplySortOrder,
} from "@/lib/api/food-supplies";
import { ApiError } from "@/lib/api/client";
import type { FoodSupply } from "@/lib/api/types";
import type { FoodSupplyFormValues } from "@/lib/validations";
import { displayDescription, formatDate, formatStockQuantity } from "@/lib/utils";
import { toast } from "sonner";
import {
  FoodSupplyForm,
  type FoodSupplyFormHandle,
} from "@/components/admin/food-supply-form";
import { FoodSupplyManualEditHistory } from "@/components/admin/food-supply-manual-edit-history";
import { SortableTableHeader } from "@/components/admin/sortable-table-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

const PER_PAGE = 10;

type SupplyDialogState =
  | { mode: "create" }
  | { mode: "edit"; supply: FoodSupply; loadingDetail?: boolean }
  | null;

function supplyToFormValues(supply: FoodSupply): Partial<FoodSupplyFormValues> {
  return {
    title: supply.title,
    description: supply.description ?? "",
    stock_quantity: supply.stock_quantity,
    unit: supply.unit,
    cooking_measurements: supply.cooking_measurements.map((measurement) => ({
      id: measurement.id,
      name: measurement.name,
      conversion_quantity: measurement.conversion_quantity,
    })),
  };
}

function formatCookingMeasurementCount(count: number) {
  if (count === 0) return null;
  return `${count} cooking measurement${count === 1 ? "" : "s"}`;
}

export default function AdminFoodSuppliesPage() {
  const [supplies, setSupplies] = useState<FoodSupply[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sortBy, setSortBy] = useState<FoodSupplySortBy>("title");
  const [sortOrder, setSortOrder] = useState<FoodSupplySortOrder>("asc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FoodSupply | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dialog, setDialog] = useState<SupplyDialogState>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<FoodSupplyFormHandle>(null);

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
      const res = await foodSuppliesAdminApi.list({
        page,
        perPage: PER_PAGE,
        search: debounced,
        sortBy,
        sortOrder,
      });
      setSupplies(res.data ?? []);
      setTotal(res.meta?.total ?? 0);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load food supplies",
      );
    } finally {
      setLoading(false);
    }
  }, [page, debounced, sortBy, sortOrder]);

  const handleSort = (column: FoodSupplySortBy) => {
    setPage(1);
    if (sortBy === column) {
      setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortOrder("asc");
  };

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await foodSuppliesAdminApi.delete(pendingDelete.id);
      toast.success("Food supply deleted");
      setPendingDelete(null);
      void load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete food supply",
      );
    } finally {
      setDeleting(false);
    }
  };

  const closeDialog = () => {
    if (saving) return;
    setDialog(null);
  };

  const openEditDialog = async (supply: FoodSupply) => {
    setDialog({ mode: "edit", supply, loadingDetail: true });
    try {
      const res = await foodSuppliesAdminApi.get(supply.id);
      setDialog({ mode: "edit", supply: res.data });
    } catch (err) {
      setDialog(null);
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to load food supply details",
      );
    }
  };

  const refreshEditDetail = async (id: string) => {
    const res = await foodSuppliesAdminApi.get(id);
    setDialog((current) =>
      current?.mode === "edit" && current.supply.id === id
        ? { mode: "edit", supply: res.data }
        : current,
    );
    return res.data;
  };

  const handleFormSubmit = async (values: FoodSupplyFormValues) => {
    if (!dialog) return;
    setSaving(true);
    try {
      const payload = foodSupplyFormToPayload(values);
      if (dialog.mode === "create") {
        await foodSuppliesAdminApi.create(payload);
        toast.success("Food supply created");
        setDialog(null);
        void load();
      } else {
        await foodSuppliesAdminApi.update(dialog.supply.id, payload);
        toast.success("Food supply updated");
        const refreshed = await refreshEditDetail(dialog.supply.id);
        formRef.current?.reset(supplyToFormValues(refreshed));
        void load();
      }
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        formRef.current?.applyServerErrors(err.fields);
      }
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save food supply",
      );
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const dialogTitle =
    dialog?.mode === "edit" ? "Edit food supply" : "Add food supply";

  const formDefaultValues =
    dialog?.mode === "edit" ? supplyToFormValues(dialog.supply) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Food Supplies</h2>
          <p className="text-muted-foreground">{total} total</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by title"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => setDialog({ mode: "create" })}>
            <Plus className="h-4 w-4" />
            Add supply
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">
                  <SortableTableHeader
                    label="Title"
                    sortKey="title"
                    activeSortBy={sortBy}
                    activeSortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">
                  <SortableTableHeader
                    label="Stock"
                    sortKey="stock"
                    activeSortBy={sortBy}
                    activeSortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 font-medium">
                  <SortableTableHeader
                    label="Updated"
                    sortKey="updated"
                    activeSortBy={sortBy}
                    activeSortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-destructive"
                  >
                    {error}
                  </td>
                </tr>
              ) : supplies.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No food supplies found.
                  </td>
                </tr>
              ) : (
                supplies.map((supply) => (
                  <tr
                    key={supply.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{supply.title}</span>
                        {!supply.has_supplier_price ? (
                          <Badge
                            variant="warning"
                            data-testid={`missing-supplier-badge-${supply.id}`}
                          >
                            Missing supplier
                          </Badge>
                        ) : null}
                      </div>
                      {formatCookingMeasurementCount(
                        supply.cooking_measurements.length,
                      ) ? (
                        <p className="text-xs font-normal text-muted-foreground">
                          {formatCookingMeasurementCount(
                            supply.cooking_measurements.length,
                          )}
                        </p>
                      ) : null}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-muted-foreground">
                      {displayDescription(supply.description)}
                    </td>
                    <td className="px-4 py-3">
                      {formatStockQuantity(supply.stock_quantity, supply.unit)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(supply.updated_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Edit food supply"
                          onClick={() => void openEditDialog(supply)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          aria-label="Delete food supply"
                          onClick={() => setPendingDelete(supply)}
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

      <Dialog open={dialog !== null} onClose={closeDialog} className="max-w-2xl">
        <DialogTitle>{dialogTitle}</DialogTitle>
        {dialog?.mode === "edit" && dialog.loadingDetail ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          dialog && (
            <>
              <FoodSupplyForm
                key={
                  dialog.mode === "edit" ? `edit-${dialog.supply.id}` : "create"
                }
                ref={formRef}
                defaultValues={formDefaultValues}
                onSubmit={handleFormSubmit}
                onCancel={closeDialog}
                isLoading={saving}
                submitLabel={
                  dialog.mode === "edit" ? "Save changes" : "Add supply"
                }
              />
              {dialog.mode === "edit" ? (
                <FoodSupplyManualEditHistory
                  history={dialog.supply.manual_edit_history}
                  unit={dialog.supply.unit}
                />
              ) : null}
            </>
          )
        )}
      </Dialog>

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold">Delete food supply</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {pendingDelete.title}
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

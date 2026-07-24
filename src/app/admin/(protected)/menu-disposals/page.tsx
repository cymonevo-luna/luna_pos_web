"use client";

import { useEffect, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Search, Trash2 } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import type { MenuDisposal } from "@/lib/api/types";
import { dateInputToIso } from "@/lib/api/transactions";
import { useFeatures } from "@/lib/auth/use-features";
import { useDeleteMenuDisposal } from "@/lib/query/hooks/use-delete-menu-disposal";
import { useMenuDisposalsListQuery } from "@/lib/query/hooks/use-menu-disposals-list";
import { useUpdateMenuDisposalDate } from "@/lib/query/hooks/use-update-menu-disposal-date";
import {
  displayDescription,
  formatDateTime,
  formatRupiah,
} from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

const PER_PAGE = 10;

function isoToDateInput(iso: string): string {
  return iso.slice(0, 10);
}

export default function AdminMenuDisposalsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pendingDelete, setPendingDelete] = useState<MenuDisposal | null>(
    null,
  );
  const [pendingEditDate, setPendingEditDate] = useState<MenuDisposal | null>(
    null,
  );
  const [editDateValue, setEditDateValue] = useState("");

  const { hasFeature } = useFeatures();
  const canDelete = hasFeature("menu_disposals.delete");
  const canEditDate = hasFeature("records.edit_date");
  const canShowActions = canDelete || canEditDate;

  const { data, isLoading, isError, error } = useMenuDisposalsListQuery({
    page,
    perPage: PER_PAGE,
    search: debounced,
    dateFrom,
    dateTo,
  });
  const { mutateAsync: deleteDisposal, isPending: deleting } =
    useDeleteMenuDisposal();
  const { mutateAsync: updateDisposedDate, isPending: savingDate } =
    useUpdateMenuDisposalDate();

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    if (isError) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Failed to load menu disposals",
      );
    }
  }, [isError, error]);

  const disposals = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const loading = isLoading;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const handleDateFromChange = (value: string) => {
    setDateFrom(value);
    setPage(1);
  };

  const handleDateToChange = (value: string) => {
    setDateTo(value);
    setPage(1);
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteDisposal(pendingDelete.id);
      toast.success("Disposal deleted and stock restored");
      setPendingDelete(null);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to delete menu disposal",
      );
    }
  };

  const openEditDateDialog = (disposal: MenuDisposal) => {
    setPendingEditDate(disposal);
    setEditDateValue(isoToDateInput(disposal.disposed_at));
  };

  const handleSaveDate = async () => {
    if (!pendingEditDate || !editDateValue) return;
    try {
      await updateDisposedDate(
        pendingEditDate.id,
        dateInputToIso(editDateValue, false),
      );
      toast.success("Disposal date updated");
      setPendingEditDate(null);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to update disposal date",
      );
    }
  };

  return (
    <div className="space-y-6" data-testid="menu-disposals-page">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Menu Disposals</h2>
          <p className="text-muted-foreground">{total} total</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by menu title"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="menu-disposals-search-input"
            />
          </div>
          <Input
            type="date"
            aria-label="Date from"
            value={dateFrom}
            onChange={(e) => handleDateFromChange(e.target.value)}
            className="w-full sm:w-40"
            data-testid="menu-disposals-date-from"
          />
          <Input
            type="date"
            aria-label="Date to"
            value={dateTo}
            onChange={(e) => handleDateToChange(e.target.value)}
            className="w-full sm:w-40"
            data-testid="menu-disposals-date-to"
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Menu</th>
                <th className="px-4 py-3 font-medium">Qty</th>
                <th className="px-4 py-3 font-medium">Unit loss</th>
                <th className="px-4 py-3 font-medium">Total loss</th>
                <th className="px-4 py-3 font-medium">Disposed by</th>
                <th className="px-4 py-3 font-medium">Note</th>
                {canShowActions ? (
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: canShowActions ? 8 : 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : disposals.length === 0 ? (
                <tr>
                  <td
                    colSpan={canShowActions ? 8 : 7}
                    className="px-4 py-10 text-center text-muted-foreground"
                    data-testid="menu-disposals-empty"
                  >
                    No menu disposals found.
                  </td>
                </tr>
              ) : (
                disposals.map((disposal) => (
                  <tr
                    key={disposal.id}
                    className="border-b border-border last:border-0"
                    data-testid={`menu-disposal-row-${disposal.id}`}
                  >
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDateTime(disposal.disposed_at)}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {disposal.menu_title}
                    </td>
                    <td className="px-4 py-3">{disposal.quantity}</td>
                    <td className="px-4 py-3">
                      {formatRupiah(disposal.unit_loss_amount)}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatRupiah(disposal.loss_amount)}
                    </td>
                    <td className="px-4 py-3">
                      {disposal.disposed_by_username ?? "—"}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-muted-foreground">
                      {displayDescription(disposal.note)}
                    </td>
                    {canShowActions ? (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {canEditDate ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label="Edit disposal date"
                              data-testid={`menu-disposal-edit-date-${disposal.id}`}
                              onClick={() => openEditDateDialog(disposal)}
                            >
                              <Calendar className="h-4 w-4" />
                            </Button>
                          ) : null}
                          {canDelete ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              aria-label="Delete disposal"
                              data-testid={`menu-disposal-delete-${disposal.id}`}
                              onClick={() => setPendingDelete(disposal)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
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
            data-testid="menu-disposals-prev-page"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            data-testid="menu-disposals-next-page"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {pendingEditDate && (
        <Dialog open onClose={() => setPendingEditDate(null)}>
          <div data-testid="menu-disposal-edit-date-dialog">
          <DialogTitle>Edit disposal date</DialogTitle>
          <DialogDescription>
            Update the disposal date for {pendingEditDate.menu_title}.
          </DialogDescription>
          <div className="mt-4">
            <Label htmlFor="disposal-date">Disposal date</Label>
            <Input
              id="disposal-date"
              type="date"
              value={editDateValue}
              onChange={(e) => setEditDateValue(e.target.value)}
              className="mt-2"
              data-testid="menu-disposal-edit-date-input"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingEditDate(null)}
              disabled={savingDate}
              data-testid="menu-disposal-edit-date-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSaveDate()}
              isLoading={savingDate}
              disabled={!editDateValue}
              data-testid="menu-disposal-edit-date-save"
            >
              Save
            </Button>
          </DialogFooter>
          </div>
        </Dialog>
      )}

      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          data-testid="menu-disposal-delete-dialog"
        >
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold">Delete disposal</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Delete disposal and restore stock?
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
                data-testid="menu-disposal-delete-cancel"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleDelete()}
                isLoading={deleting}
                data-testid="menu-disposal-delete-confirm"
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

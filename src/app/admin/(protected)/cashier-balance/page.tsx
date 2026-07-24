"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, ChevronRight, Calendar, Minus, Plus, Trash2 } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import {
  cashierBalanceAdjustmentFormToPayload,
  isCashierBalanceEntryDateEditable,
  isCashierBalanceEntryDeletable,
} from "@/lib/api/cashier-balance";
import type { CashierBalanceAdjustmentType, CashierBalanceEntry } from "@/lib/api/types";
import { useFeatures } from "@/lib/auth/use-features";
import {
  useCashierBalance,
  useCashierBalanceEntries,
  useCreateCashierBalanceAdjustment,
  useDeleteCashierBalanceEntry,
  useUpdateCashierBalanceEntryRecordDate,
} from "@/lib/hooks/use-cashier-balance";
import {
  cashierBalanceAdjustmentSchema,
  type CashierBalanceAdjustmentFormValues,
} from "@/lib/validations";
import { cn, dateToDatetimeLocalInput, datetimeLocalInputToIso, formatDateTime, formatRupiah } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const PER_PAGE = 10;

type AdjustmentDialogState = {
  type: CashierBalanceAdjustmentType;
} | null;

function blockDecimalInput(event: React.KeyboardEvent<HTMLInputElement>) {
  if (
    event.key === "." ||
    event.key === "," ||
    event.key === "e" ||
    event.key === "E"
  ) {
    event.preventDefault();
  }
}

function formatSignedCashierAmount(entry: CashierBalanceEntry) {
  const signedPrefix = entry.type === "ADD" ? "+" : "-";
  return `${signedPrefix}${formatRupiah(entry.amount)}`;
}

function signedAmountClassName(type: CashierBalanceAdjustmentType) {
  return type === "ADD"
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-destructive";
}

function getDeleteEntryErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "entry_not_deletable") {
      return "Transaction-linked entries cannot be removed.";
    }
    if (err.code === "insufficient_balance") {
      return (
        err.message || "Removing this entry would overdraw the cashier balance."
      );
    }
    return err.message;
  }
  return "Failed to remove history item";
}

function getEditDateErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return err.message;
  }
  return "Failed to update entry date";
}

export default function AdminCashierBalancePage() {
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<AdjustmentDialogState>(null);
  const [pendingDelete, setPendingDelete] = useState<CashierBalanceEntry | null>(
    null,
  );
  const [pendingEditDate, setPendingEditDate] =
    useState<CashierBalanceEntry | null>(null);
  const [editDateValue, setEditDateValue] = useState("");
  const { hasFeature } = useFeatures();
  const canDeleteEntry = hasFeature("cashier_balance.delete_entry");
  const canEditDate = hasFeature("records.edit_date");

  const {
    balance,
    loading: balanceLoading,
    error: balanceError,
  } = useCashierBalance();
  const {
    entries,
    meta,
    loading: entriesLoading,
    error: entriesError,
  } = useCashierBalanceEntries({ page, perPage: PER_PAGE });
  const { mutateAsync: createAdjustment, isPending: saving } =
    useCreateCashierBalanceAdjustment();
  const { mutateAsync: deleteEntry, isPending: deleting } =
    useDeleteCashierBalanceEntry();
  const { mutateAsync: updateEntryDate, isPending: savingDate } =
    useUpdateCashierBalanceEntryRecordDate();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors },
  } = useForm<CashierBalanceAdjustmentFormValues>({
    resolver: zodResolver(cashierBalanceAdjustmentSchema),
    defaultValues: {
      type: "ADD",
      amount: Number.NaN,
      purpose: "",
    },
  });

  const total = meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const loading = balanceLoading || entriesLoading;
  const showActionsColumn = canDeleteEntry || canEditDate;
  const columnCount = showActionsColumn ? 6 : 5;

  const openDialog = (type: CashierBalanceAdjustmentType) => {
    reset({
      type,
      amount: Number.NaN,
      purpose: "",
    });
    setDialog({ type });
  };

  const closeDialog = () => {
    if (saving) return;
    setDialog(null);
  };

  const onSubmit = async (values: CashierBalanceAdjustmentFormValues) => {
    try {
      await createAdjustment(cashierBalanceAdjustmentFormToPayload(values));
      toast.success(
        values.type === "ADD"
          ? "Cash added to cashier balance"
          : "Cash deducted from cashier balance",
      );
      setDialog(null);
      setPage(1);
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        for (const [field, message] of Object.entries(err.fields)) {
          if (field === "type" || field === "amount" || field === "purpose") {
            setError(field, { message });
          }
        }
      }
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save adjustment",
      );
    }
  };

  const closeDeleteDialog = () => {
    if (deleting) return;
    setPendingDelete(null);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    try {
      await deleteEntry(pendingDelete.id);
      toast.success("Cashier balance history item removed");
      setPendingDelete(null);
    } catch (err) {
      toast.error(getDeleteEntryErrorMessage(err));
    }
  };

  const openEditDateDialog = (entry: CashierBalanceEntry) => {
    setEditDateValue(dateToDatetimeLocalInput(entry.created_at));
    setPendingEditDate(entry);
  };

  const closeEditDateDialog = () => {
    if (savingDate) return;
    setPendingEditDate(null);
  };

  const confirmEditDate = async () => {
    if (!pendingEditDate || !editDateValue) return;

    try {
      await updateEntryDate(
        pendingEditDate.id,
        new Date(datetimeLocalInputToIso(editDateValue)),
      );
      toast.success("Entry date updated");
      setPendingEditDate(null);
    } catch (err) {
      toast.error(getEditDateErrorMessage(err));
    }
  };

  const dialogTitle =
    dialog?.type === "DEDUCT" ? "Deduct cashier balance" : "Add cashier balance";

  return (
    <div className="space-y-6" data-testid="cashier-balance-page">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Cashier Balance</h2>
          <p className="text-muted-foreground">
            Track cash on hand and manual adjustments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => openDialog("ADD")}
            data-testid="cashier-balance-add-button"
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
          <Button
            variant="destructive"
            onClick={() => openDialog("DEDUCT")}
            data-testid="cashier-balance-deduct-button"
          >
            <Minus className="h-4 w-4" />
            Deduct
          </Button>
        </div>
      </div>

      <Card className="p-6" data-testid="cashier-balance-summary-card">
        <p className="text-sm text-muted-foreground">Current balance</p>
        {balanceLoading ? (
          <Skeleton className="mt-2 h-10 w-48" data-testid="cashier-balance-loading" />
        ) : balanceError ? (
          <p className="mt-2 text-destructive">{balanceError}</p>
        ) : (
          <p
            className="mt-2 text-3xl font-semibold tabular-nums"
            data-testid="cashier-balance-amount"
          >
            {formatRupiah(balance?.balance ?? 0)}
          </p>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Datetime</th>
                <th className="px-4 py-3 font-medium">Transaction Id</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Purpose</th>
                <th className="px-4 py-3 font-medium">Requested By</th>
                {showActionsColumn ? (
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: columnCount }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : entriesError ? (
                <tr>
                  <td
                    colSpan={columnCount}
                    className="px-4 py-10 text-center text-destructive"
                  >
                    {entriesError}
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td
                    colSpan={columnCount}
                    className="px-4 py-10 text-center text-muted-foreground"
                    data-testid="cashier-balance-empty-state"
                  >
                    No cashier balance adjustments yet.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const showDelete =
                    canDeleteEntry && isCashierBalanceEntryDeletable(entry);
                  const showEditDate =
                    canEditDate && isCashierBalanceEntryDateEditable(entry);

                  return (
                  <tr
                    key={entry.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                    data-testid={`cashier-balance-entry-${entry.id}`}
                  >
                    <td className="px-4 py-3 text-muted-foreground">
                      <time dateTime={entry.created_at}>
                        {formatDateTime(entry.created_at)}
                      </time>
                    </td>
                    <td className="px-4 py-3">
                      {entry.transaction_id ? (
                        <Link
                          href={`/admin/transactions/${entry.transaction_id}`}
                          className="text-primary hover:underline"
                        >
                          {entry.transaction_id}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 font-medium tabular-nums",
                        signedAmountClassName(entry.type),
                      )}
                      data-testid={`cashier-balance-entry-amount-${entry.id}`}
                    >
                      {formatSignedCashierAmount(entry)}
                    </td>
                    <td className="px-4 py-3">{entry.purpose}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {entry.requested_by_username ?? "—"}
                    </td>
                    {showActionsColumn ? (
                      <td className="px-4 py-3">
                        {showEditDate || showDelete ? (
                          <div className="flex justify-end gap-1">
                            {showEditDate ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label="Edit date"
                                data-testid={`cashier-balance-edit-date-${entry.id}`}
                                onClick={() => openEditDateDialog(entry)}
                              >
                                <Calendar className="h-4 w-4" />
                              </Button>
                            ) : null}
                            {showDelete ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                aria-label="Remove history item"
                                data-testid={`cashier-balance-delete-${entry.id}`}
                                onClick={() => setPendingDelete(entry)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    ) : null}
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
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={dialog !== null} onClose={closeDialog} className="max-w-md">
        <DialogTitle>{dialogTitle}</DialogTitle>
        <form
          className="mt-4 space-y-4"
          onSubmit={handleSubmit(onSubmit)}
          data-testid="cashier-balance-adjustment-form"
        >
          <div className="space-y-2">
            <Label htmlFor="adjustment-type">Type</Label>
            <Select
              id="adjustment-type"
              options={[
                { value: "ADD", label: "Add" },
                { value: "DEDUCT", label: "Deduct" },
              ]}
              {...register("type", {
                onChange: (event) => {
                  const nextType = event.target.value as CashierBalanceAdjustmentType;
                  setValue("type", nextType, { shouldValidate: true });
                  setDialog({ type: nextType });
                },
              })}
            />
            {errors.type && (
              <p className="text-sm text-destructive">{errors.type.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="adjustment-amount">Amount (IDR)</Label>
            <Input
              id="adjustment-amount"
              type="number"
              inputMode="numeric"
              step={1}
              min={1}
              placeholder="0"
              data-testid="cashier-balance-amount-input"
              onKeyDown={blockDecimalInput}
              {...register("amount", { valueAsNumber: true })}
            />
            {errors.amount && (
              <p className="text-sm text-destructive">{errors.amount.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="adjustment-purpose">Purpose</Label>
            <Input
              id="adjustment-purpose"
              placeholder="Reason for adjustment"
              data-testid="cashier-balance-purpose-input"
              {...register("purpose")}
            />
            {errors.purpose && (
              <p className="text-sm text-destructive">{errors.purpose.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving} data-testid="cashier-balance-submit">
              {dialog?.type === "DEDUCT" ? "Deduct" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      <Dialog
        open={pendingEditDate !== null}
        onClose={closeEditDateDialog}
        className="max-w-md"
      >
        <DialogTitle>Edit date</DialogTitle>
        <DialogDescription>
          Update the reporting date for this manual adjustment.
        </DialogDescription>
        <div className="mt-4 space-y-2">
          <Label htmlFor="cashier-balance-edit-date">Date</Label>
          <Input
            id="cashier-balance-edit-date"
            type="datetime-local"
            value={editDateValue}
            data-testid="cashier-balance-edit-date-input"
            onChange={(event) => setEditDateValue(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={closeEditDateDialog}
            disabled={savingDate}
          >
            Cancel
          </Button>
          <Button
            type="button"
            isLoading={savingDate}
            data-testid="cashier-balance-edit-date-confirm"
            onClick={() => void confirmEditDate()}
          >
            Save
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog
        open={pendingDelete !== null}
        onClose={closeDeleteDialog}
        className="max-w-md"
      >
        <DialogTitle>Remove history item</DialogTitle>
        <DialogDescription>
          Remove this history item? This will adjust the cashier balance.
        </DialogDescription>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={closeDeleteDialog}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            isLoading={deleting}
            data-testid="cashier-balance-delete-confirm"
            onClick={() => void confirmDelete()}
          >
            Remove
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

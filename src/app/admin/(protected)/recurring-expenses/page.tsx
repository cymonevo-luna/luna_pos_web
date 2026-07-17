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
  formatRecurringScheduleSummary,
  isStaffManagedRecurringExpense,
  recurringExpensesAdminApi,
  recurringExpenseFormToPayload,
  STAFF_MANAGED_RECURRING_EXPENSE_MESSAGE,
  STAFF_MANAGED_RECURRING_EXPENSE_TOOLTIP,
} from "@/lib/api/recurring-expenses";
import { ApiError } from "@/lib/api/client";
import type { RecurringExpense } from "@/lib/api/types";
import type { RecurringExpenseFormValues } from "@/lib/validations";
import { formatDateTime, formatRupiah } from "@/lib/utils";
import { toast } from "sonner";
import {
  RecurringExpenseForm,
  type RecurringExpenseFormHandle,
} from "@/components/admin/recurring-expense-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

const PER_PAGE = 10;

type RecurringExpenseDialogState =
  | { mode: "create" }
  | { mode: "edit"; expense: RecurringExpense }
  | null;

function expenseToFormValues(
  expense: RecurringExpense,
): Partial<RecurringExpenseFormValues> {
  return {
    title: expense.title,
    description: expense.description ?? "",
    amount: expense.amount,
    is_active: expense.is_active,
    recurring: {
      interval: expense.recurring.interval,
      value: expense.recurring.value ?? undefined,
      time: {
        hour: expense.recurring.time.hour,
        minute: expense.recurring.time.minute,
        second: expense.recurring.time.second,
      },
    },
  };
}

export default function AdminRecurringExpensesPage() {
  const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RecurringExpense | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [dialog, setDialog] = useState<RecurringExpenseDialogState>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<RecurringExpenseFormHandle>(null);

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
      const res = await recurringExpensesAdminApi.list({
        page,
        perPage: PER_PAGE,
        search: debounced,
      });
      setExpenses(res.data ?? []);
      setTotal(res.meta?.total ?? 0);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to load recurring expenses",
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
      await recurringExpensesAdminApi.delete(pendingDelete.id);
      toast.success("Recurring expense deleted");
      setPendingDelete(null);
      void load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error(STAFF_MANAGED_RECURRING_EXPENSE_MESSAGE);
      } else {
        toast.error(
          err instanceof ApiError
            ? err.message
            : "Failed to delete recurring expense",
        );
      }
    } finally {
      setDeleting(false);
    }
  };

  const closeDialog = () => {
    if (saving) return;
    setDialog(null);
  };

  const handleFormSubmit = async (values: RecurringExpenseFormValues) => {
    if (!dialog) return;
    setSaving(true);
    try {
      const payload = recurringExpenseFormToPayload(values);
      if (dialog.mode === "create") {
        await recurringExpensesAdminApi.create(payload);
        toast.success("Recurring expense created");
      } else {
        await recurringExpensesAdminApi.update(dialog.expense.id, payload);
        toast.success("Recurring expense updated");
      }
      setDialog(null);
      void load();
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        formRef.current?.applyServerErrors(err.fields);
      }
      if (err instanceof ApiError && err.status === 409) {
        toast.error(STAFF_MANAGED_RECURRING_EXPENSE_MESSAGE);
      } else {
        toast.error(
          err instanceof ApiError
            ? err.message
            : "Failed to save recurring expense",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const dialogTitle =
    dialog?.mode === "edit"
      ? "Edit recurring expense"
      : "Add recurring expense";

  const formDefaultValues =
    dialog?.mode === "edit"
      ? expenseToFormValues(dialog.expense)
      : undefined;

  const editingStaffManagedExpense =
    dialog?.mode === "edit" &&
    isStaffManagedRecurringExpense(dialog.expense);

  return (
    <div className="space-y-6" data-testid="recurring-expenses-page">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Recurring Expenses</h2>
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
            Create
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Schedule</th>
                <th className="px-4 py-3 font-medium">Next run</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-destructive"
                  >
                    {error}
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No recurring expenses found.
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => {
                  const staffManaged = isStaffManagedRecurringExpense(expense);

                  return (
                  <tr
                    key={expense.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{expense.title}</span>
                        {staffManaged && (
                          <Badge
                            variant="outline"
                            title={STAFF_MANAGED_RECURRING_EXPENSE_TOOLTIP}
                            data-testid="staff-salary-badge"
                          >
                            Staff salary
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {formatRupiah(expense.amount)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatRecurringScheduleSummary(expense.recurring)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {expense.next_run_at
                        ? formatDateTime(expense.next_run_at)
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={expense.is_active ? "success" : "secondary"}
                      >
                        {expense.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {staffManaged ? (
                        <span className="text-muted-foreground text-xs">
                          View only
                        </span>
                      ) : (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Edit recurring expense"
                          onClick={() =>
                            setDialog({ mode: "edit", expense })
                          }
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          aria-label="Delete recurring expense"
                          onClick={() => setPendingDelete(expense)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      )}
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

      <Dialog open={dialog !== null} onClose={closeDialog} className="max-w-lg">
        <DialogTitle>{dialogTitle}</DialogTitle>
        {dialog && (
          <RecurringExpenseForm
            key={
              dialog.mode === "edit"
                ? `edit-${dialog.expense.id}`
                : "create"
            }
            ref={formRef}
            defaultValues={formDefaultValues}
            onSubmit={handleFormSubmit}
            onCancel={closeDialog}
            isLoading={saving}
            showIsActive={dialog.mode === "edit"}
            readOnly={editingStaffManagedExpense}
            submitLabel={
              dialog.mode === "edit" ? "Save changes" : "Create"
            }
          />
        )}
      </Dialog>

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold">Delete recurring expense</h3>
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

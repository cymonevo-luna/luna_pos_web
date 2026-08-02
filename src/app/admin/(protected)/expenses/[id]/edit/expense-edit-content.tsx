"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  expenseFormToPayload,
  expenseToFormValues,
} from "@/lib/api/expenses";
import { ApiError } from "@/lib/api/client";
import type { Expense } from "@/lib/api/types";
import type { ExpenseFormValues } from "@/lib/validations";
import { useAuth } from "@/lib/auth/context";
import {
  useExpense,
  useUpdateExpense,
  useUpdateExpenseRecordDate,
} from "@/lib/hooks/use-expenses";
import { datesEqualToMinute, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import {
  ExpenseForm,
  type ExpenseFormHandle,
} from "@/components/admin/expense-form";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function expenseDetailsChanged(
  expense: Expense,
  values: ExpenseFormValues,
): boolean {
  const payload = expenseFormToPayload(values, { includeEmptyReceipt: true });

  return (
    payload.title !== expense.title.trim() ||
    (payload.description ?? "") !== (expense.description ?? "") ||
    payload.amount !== expense.amount ||
    payload.source_of_fund !== (expense.source_of_fund ?? "PERSONAL_MONEY") ||
    (payload.receipt_url ?? "") !== (expense.receipt_url ?? "")
  );
}

export function AdminEditExpenseContent({ id }: { id: string }) {
  const router = useRouter();
  const formRef = useRef<ExpenseFormHandle>(null);
  const { user } = useAuth();
  const { expense, loading, error } = useExpense(id);
  const [displayExpense, setDisplayExpense] = useState<Expense | null>(null);
  const { mutateAsync: updateExpense, isPending: savingExpense } =
    useUpdateExpense();
  const { mutateAsync: updateExpenseRecordDate, isPending: savingRecordDate } =
    useUpdateExpenseRecordDate();
  const canEditRecordDate =
    Array.isArray(user?.features) &&
    user.features.includes("records.edit_date");
  const saving = savingExpense || savingRecordDate;

  useEffect(() => {
    if (expense) {
      setDisplayExpense(expense);
    }
  }, [expense]);

  const handleSubmit = async (values: ExpenseFormValues) => {
    if (!displayExpense) return;

    const originalDate = new Date(displayExpense.transaction_date);
    const recordDateChanged =
      canEditRecordDate &&
      values.recordDate instanceof Date &&
      !datesEqualToMinute(values.recordDate, originalDate);
    const detailsChanged = expenseDetailsChanged(displayExpense, values);

    if (!recordDateChanged && !detailsChanged) {
      toast.success("Expense updated");
      router.push("/admin/expenses");
      return;
    }

    try {
      if (recordDateChanged && values.recordDate) {
        try {
          const result = await updateExpenseRecordDate(id, values.recordDate);
          setDisplayExpense(result.data);
        } catch (err) {
          if (err instanceof ApiError && err.status === 403) {
            toast.error("You don't have permission to edit dates.");
            return;
          }
          throw err;
        }
      }

      if (detailsChanged) {
        const result = await updateExpense(
          id,
          expenseFormToPayload(values, { includeEmptyReceipt: true }),
        );
        setDisplayExpense(result.data);
      }

      toast.success("Expense updated");
      router.push("/admin/expenses");
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        formRef.current?.applyServerErrors(err.fields);
      }
      toast.error(
        err instanceof ApiError ? err.message : "Failed to update expense",
      );
    }
  };

  return (
    <div className="max-w-2xl space-y-6" data-testid="expense-edit-page">
      <Link
        href="/admin/expenses"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to expenses
      </Link>

      {loading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent
            className="py-10 text-center text-destructive"
            data-testid="expense-edit-error"
          >
            {error}
          </CardContent>
        </Card>
      ) : displayExpense ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit expense</CardTitle>
            <div
              className="mt-2 grid gap-4 sm:grid-cols-2"
              data-testid="expense-transaction-date-card"
            >
              <div>
                <CardDescription>Transaction date</CardDescription>
                <p
                  className="text-lg font-semibold"
                  data-testid="expense-transaction-date-display"
                >
                  {formatDateTime(displayExpense.transaction_date)}
                </p>
                <p
                  className="text-xs text-muted-foreground"
                  data-testid="expense-recorded-at-display"
                  title={`System created at ${formatDateTime(displayExpense.created_at)}`}
                >
                  Recorded at {formatDateTime(displayExpense.created_at)}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ExpenseForm
              key={displayExpense.id}
              ref={formRef}
              defaultValues={expenseToFormValues(displayExpense)}
              showRecordDate={canEditRecordDate}
              onSubmit={handleSubmit}
              onCancel={() => router.push("/admin/expenses")}
              isLoading={saving}
              submitLabel="Save changes"
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

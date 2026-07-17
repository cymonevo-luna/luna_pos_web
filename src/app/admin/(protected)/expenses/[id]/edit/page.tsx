"use client";

import { use, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { expenseFormToPayload, expenseToFormValues } from "@/lib/api/expenses";
import { ApiError } from "@/lib/api/client";
import type { ExpenseFormValues } from "@/lib/validations";
import { useExpense, useUpdateExpense } from "@/lib/hooks/use-expenses";
import { toast } from "sonner";
import {
  ExpenseForm,
  type ExpenseFormHandle,
} from "@/components/admin/expense-form";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminEditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const formRef = useRef<ExpenseFormHandle>(null);
  const { expense, loading, error } = useExpense(id);
  const { mutateAsync: updateExpense, isPending: saving } = useUpdateExpense();

  const handleSubmit = async (values: ExpenseFormValues) => {
    try {
      await updateExpense(
        id,
        expenseFormToPayload(values, { includeEmptyReceipt: true }),
      );
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
      ) : expense ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit expense</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpenseForm
              key={expense.id}
              ref={formRef}
              defaultValues={expenseToFormValues(expense)}
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

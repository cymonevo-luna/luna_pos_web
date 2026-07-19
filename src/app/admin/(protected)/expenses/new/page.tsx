"use client";

import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { expenseFormToPayload } from "@/lib/api/expenses";
import { ApiError } from "@/lib/api/client";
import type { ExpenseFormValues } from "@/lib/validations";
import { useCreateExpense } from "@/lib/hooks/use-expenses";
import { toast } from "sonner";
import {
  ExpenseForm,
  type ExpenseFormHandle,
} from "@/components/admin/expense-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminNewExpensePage() {
  const router = useRouter();
  const formRef = useRef<ExpenseFormHandle>(null);
  const { mutateAsync: createExpense, isPending: saving } = useCreateExpense();

  const handleSubmit = async (values: ExpenseFormValues) => {
    try {
      await createExpense(expenseFormToPayload(values));
      toast.success("Expense created");
      router.push("/admin/expenses");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields) {
          formRef.current?.applyServerErrors(err.fields);
        } else if (err.code === "insufficient_balance") {
          formRef.current?.applyServerErrors({
            source_of_fund: err.message,
          });
        }
        toast.error(err.message);
      } else {
        toast.error("Failed to create expense");
      }
    }
  };

  return (
    <div className="max-w-2xl space-y-6" data-testid="expense-new-page">
      <Link
        href="/admin/expenses"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to expenses
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>New expense</CardTitle>
        </CardHeader>
        <CardContent>
          <ExpenseForm
            ref={formRef}
            onSubmit={handleSubmit}
            onCancel={() => router.push("/admin/expenses")}
            isLoading={saving}
            submitLabel="Create expense"
          />
        </CardContent>
      </Card>
    </div>
  );
}

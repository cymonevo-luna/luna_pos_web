"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { transactionsAdminApi } from "@/lib/api/transactions";
import { ApiError } from "@/lib/api/client";
import type { Transaction } from "@/lib/api/types";
import { useRoles } from "@/lib/auth/use-roles";
import { useDeleteTransaction } from "@/lib/query/hooks/use-delete-transaction";
import { formatDateTime, formatRupiah } from "@/lib/utils";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AdminTransactionDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const { hasRole } = useRoles();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);
  const { mutateAsync: deleteTransaction, isPending: deleting } =
    useDeleteTransaction();

  useEffect(() => {
    transactionsAdminApi
      .get(id)
      .then((res) => setTransaction(res.data ?? null))
      .catch((err) => {
        const message =
          err instanceof ApiError ? err.message : "Failed to load transaction";
        setError(message);
        toast.error(message);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    try {
      await deleteTransaction(id);
      toast.success("Transaction deleted");
      router.push("/admin/transactions");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete transaction",
      );
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <Link
        href="/admin/transactions"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to transactions
      </Link>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
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
      ) : transaction ? (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-mono text-sm text-muted-foreground">
                {transaction.id}
              </h2>
              <p className="text-2xl font-semibold">
                {formatDateTime(transaction.transaction_date)}
              </p>
            </div>
            {hasRole("admin") && (
              <Button
                variant="destructive"
                onClick={() => setPendingDelete(true)}
              >
                Delete transaction
              </Button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Amount</CardDescription>
                <CardTitle className="text-xl">
                  {formatRupiah(transaction.amount)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Method</CardDescription>
                <CardTitle className="text-xl">{transaction.method}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Cashier</CardDescription>
                <CardTitle className="text-xl">
                  {transaction.cashier_username}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {transaction.method === "CASH" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cash payment</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm text-muted-foreground">
                      Cash tendered
                    </dt>
                    <dd className="text-lg font-medium">
                      {formatRupiah(transaction.cash_tendered ?? 0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Change</dt>
                    <dd className="text-lg font-medium">
                      {formatRupiah(transaction.change_amount ?? 0)}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )}

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">Line items</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">Quantity</th>
                    <th className="px-4 py-3 font-medium">Unit price</th>
                    <th className="px-4 py-3 font-medium">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {transaction.items.map((item) => (
                    <tr
                      key={`${item.menu_id}-${item.title}`}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-4 py-3 font-medium">{item.title}</td>
                      <td className="px-4 py-3">{item.quantity}</td>
                      <td className="px-4 py-3">
                        {formatRupiah(item.unit_price)}
                      </td>
                      <td className="px-4 py-3">
                        {formatRupiah(item.line_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}

      {pendingDelete && transaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold">Delete transaction</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to delete the transaction from{" "}
              <span className="font-medium text-foreground">
                {formatDateTime(transaction.transaction_date)}
              </span>{" "}
              for{" "}
              <span className="font-medium text-foreground">
                {formatRupiah(transaction.amount)}
              </span>
              ? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setPendingDelete(false)}
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

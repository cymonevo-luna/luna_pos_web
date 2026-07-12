"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { transactionsAdminApi } from "@/lib/api/transactions";
import { ApiError } from "@/lib/api/client";
import type { Transaction } from "@/lib/api/types";
import { formatDateTime, formatRupiah } from "@/lib/utils";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AdminTransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          <div>
            <h2 className="font-mono text-sm text-muted-foreground">
              {transaction.id}
            </h2>
            <p className="text-2xl font-semibold">
              {formatDateTime(transaction.transaction_date)}
            </p>
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

          {transaction.method === "OFFLINE" && (
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
                      {formatRupiah(transaction.cash_tendered)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Change</dt>
                    <dd className="text-lg font-medium">
                      {formatRupiah(transaction.change_amount)}
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
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { transactionsAdminApi } from "@/lib/api/transactions";
import { ApiError } from "@/lib/api/client";
import type { Transaction } from "@/lib/api/types";
import { useRoles } from "@/lib/auth/use-roles";
import { formatDateTime, formatRupiah, truncateId } from "@/lib/utils";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const SKELETON_ROWS = 4;
const PER_PAGE = 5;

function transactionTitle(txn: Transaction) {
  const cashier = txn.cashier_username?.trim();
  return cashier || truncateId(txn.id);
}

export function RecentTransactionsPanel() {
  const { hasRole } = useRoles();
  const isManager = hasRole("manager");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(isManager);

  useEffect(() => {
    if (!isManager) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await transactionsAdminApi.list({
          page: 1,
          perPage: PER_PAGE,
        });
        if (!cancelled) {
          setTransactions(res.data ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err instanceof ApiError
              ? err.message
              : "Failed to load transactions",
          );
          setTransactions([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [isManager]);

  if (!isManager) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Recent transactions</CardTitle>
        <Link
          href="/admin/transactions"
          className="text-sm font-medium text-primary hover:underline"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ul className="divide-y divide-border">
            {Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <li
                key={index}
                className="flex items-center gap-3 py-3 first:pt-0"
              >
                <Skeleton className="h-2.5 w-2.5 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-3 w-24" />
              </li>
            ))}
          </ul>
        ) : transactions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No transactions yet
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {transactions.map((txn) => (
              <li key={txn.id}>
                <Link
                  href={`/admin/transactions/${txn.id}`}
                  className="-mx-2 flex items-center gap-3 rounded-md px-2 py-3 first:pt-0 hover:bg-muted/30"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {transactionTitle(txn)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatRupiah(txn.amount)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(txn.transaction_date)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

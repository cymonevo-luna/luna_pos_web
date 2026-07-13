"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { transactionsAdminApi } from "@/lib/api/transactions";
import { ApiError } from "@/lib/api/client";
import type { Transaction, TransactionMethod } from "@/lib/api/types";
import { formatDate, formatRupiah, truncateId } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
const PER_PAGE = 10;

const METHOD_OPTIONS = [
  { value: "", label: "All methods" },
  { value: "CASH", label: "Cash" },
  { value: "QRIS", label: "QRIS" },
];

export default function AdminTransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [method, setMethod] = useState<TransactionMethod | "">("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await transactionsAdminApi.list({
        page,
        perPage: PER_PAGE,
        method,
        dateFrom,
        dateTo,
      });
      setTransactions(res.data ?? []);
      setTotal(res.meta?.total ?? 0);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to load transactions",
      );
      setTransactions([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, method, dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDateFromChange = (value: string) => {
    setDateFrom(value);
    setPage(1);
  };

  const handleDateToChange = (value: string) => {
    setDateTo(value);
    setPage(1);
  };

  const handleMethodChange = (value: string) => {
    setMethod(value as TransactionMethod | "");
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Transactions</h2>
          <p className="text-muted-foreground">{total} total</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            type="date"
            aria-label="Date from"
            value={dateFrom}
            onChange={(e) => handleDateFromChange(e.target.value)}
            className="w-full sm:w-40"
          />
          <Input
            type="date"
            aria-label="Date to"
            value={dateTo}
            onChange={(e) => handleDateToChange(e.target.value)}
            className="w-full sm:w-40"
          />
          <Select
            aria-label="Filter by method"
            className="w-full sm:w-40"
            options={METHOD_OPTIONS}
            value={method}
            onChange={(e) => handleMethodChange(e.target.value)}
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Cashier</th>
                <th className="px-4 py-3 font-medium">Items</th>
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
              ) : transactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No transactions found.
                  </td>
                </tr>
              ) : (
                transactions.map((txn) => (
                  <tr
                    key={txn.id}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30"
                    onClick={() => router.push(`/admin/transactions/${txn.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {truncateId(txn.id)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(txn.transaction_date)}
                    </td>
                    <td className="px-4 py-3">{txn.method}</td>
                    <td className="px-4 py-3 font-medium">
                      {formatRupiah(txn.amount)}
                    </td>
                    <td className="px-4 py-3">{txn.cashier_username}</td>
                    <td className="px-4 py-3">{txn.items.length}</td>
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
    </div>
  );
}

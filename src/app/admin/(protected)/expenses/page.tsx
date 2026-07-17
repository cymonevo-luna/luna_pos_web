"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
} from "lucide-react";
import { ApiError } from "@/lib/api/client";
import type { Expense } from "@/lib/api/types";
import { useDeleteExpense, useExpenses } from "@/lib/hooks/use-expenses";
import {
  displayDescription,
  formatDateTime,
  formatRupiah,
  menuPhotoUrl,
} from "@/lib/utils";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

const PER_PAGE = 10;

function ReceiptCell({ receiptUrl }: { receiptUrl?: string | null }) {
  const trimmed = receiptUrl?.trim();
  if (!trimmed) {
    return <span className="text-muted-foreground">—</span>;
  }

  const href = menuPhotoUrl(trimmed);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex"
      aria-label="View receipt"
      data-testid="expense-receipt-link"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30 transition hover:ring-2 hover:ring-primary/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={href}
          alt="Receipt"
          className="h-full w-full object-cover"
        />
      </div>
    </a>
  );
}

export default function AdminExpensesPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null);

  const { expenses, meta, loading, error } = useExpenses({
    page,
    perPage: PER_PAGE,
    search: debounced,
  });
  const { mutateAsync: deleteExpense, isPending: deleting } =
    useDeleteExpense();

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [search]);

  const total = meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteExpense(pendingDelete.id);
      toast.success("Expense deleted");
      setPendingDelete(null);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete expense",
      );
    }
  };

  const openEdit = (expense: Expense) => {
    router.push(`/admin/expenses/${expense.id}/edit`);
  };

  return (
    <div className="space-y-6" data-testid="expenses-page">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Expenses</h2>
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
              data-testid="expenses-search-input"
            />
          </div>
          <Link href="/admin/expenses/new" className={buttonVariants()}>
            <Plus className="h-4 w-4" />
            New expense
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Receipt</th>
                <th className="px-4 py-3 font-medium">Created by</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-destructive"
                    data-testid="expenses-error"
                  >
                    {error}
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-muted-foreground"
                    data-testid="expenses-empty"
                  >
                    No expenses found.
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => (
                  <tr
                    key={expense.id}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30"
                    data-testid={`expense-row-${expense.id}`}
                    onClick={() => openEdit(expense)}
                  >
                    <td className="px-4 py-3 font-medium">{expense.title}</td>
                    <td className="max-w-xs px-4 py-3 text-muted-foreground">
                      {displayDescription(expense.description)}
                    </td>
                    <td className="px-4 py-3">{formatRupiah(expense.amount)}</td>
                    <td className="px-4 py-3">
                      <ReceiptCell receiptUrl={expense.receipt_url} />
                    </td>
                    <td className="px-4 py-3">
                      {expense.created_by_username ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDateTime(expense.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Edit expense"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEdit(expense);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          aria-label="Delete expense"
                          data-testid={`expense-delete-${expense.id}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setPendingDelete(expense);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
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
            data-testid="expenses-prev-page"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            data-testid="expenses-next-page"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          data-testid="expense-delete-dialog"
        >
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold">Delete expense</h3>
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
                data-testid="expense-delete-cancel"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleDelete()}
                isLoading={deleting}
                data-testid="expense-delete-confirm"
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

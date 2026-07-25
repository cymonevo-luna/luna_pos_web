"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, Plus, Sparkles, Upload } from "lucide-react";
import { PurchaseImportDialog } from "@/components/admin/purchase-import-dialog";
import {
  downloadPurchaseRequestsCsv,
  exportPurchaseRequestsCsv,
  purchaseRequestsAdminApi,
} from "@/lib/api/purchase-requests";
import { ApiError } from "@/lib/api/client";
import type {
  PurchaseRequestStatus,
  PurchaseRequestSummary,
} from "@/lib/api/types";
import { useFeatures } from "@/lib/auth/use-features";
import { todayWIB } from "@/lib/datetime/wib";
import { formatDate, formatPurchaseSummaryTotal, formatRupiah } from "@/lib/utils";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  HistoryDateRangeFilter,
  type HistoryDateRangeValue,
} from "@/components/admin/history-date-range-filter";

const PER_PAGE = 10;

const INITIAL_DATE_RANGE: HistoryDateRangeValue = {
  preset: "all",
  dateFrom: "",
  dateTo: "",
};

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "PENDING" },
  { value: "REQUESTED", label: "REQUESTED" },
  { value: "PAID", label: "PAID" },
  { value: "DELIVERED", label: "DELIVERED" },
];

const EXPORT_STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "PENDING", label: "PENDING" },
  { value: "REQUESTED", label: "REQUESTED" },
  { value: "PAID", label: "PAID" },
  { value: "DELIVERED", label: "DELIVERED" },
];

function purchaseStatusBadgeVariant(
  status: PurchaseRequestStatus,
): NonNullable<BadgeProps["variant"]> {
  switch (status) {
    case "PENDING":
      return "secondary";
    case "REQUESTED":
      return "default";
    case "PAID":
      return "warning";
    case "DELIVERED":
      return "success";
    default:
      return "secondary";
  }
}

export default function AdminPurchasesPage() {
  const router = useRouter();
  const { hasFeature } = useFeatures();
  const canExport = hasFeature("purchases.manage");
  const canImport = hasFeature("purchases.manage");
  const [purchases, setPurchases] = useState<PurchaseRequestSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<PurchaseRequestStatus | "">("");
  const [dateRange, setDateRange] =
    useState<HistoryDateRangeValue>(INITIAL_DATE_RANGE);
  const [loading, setLoading] = useState(true);
  const [exportTransactionDate, setExportTransactionDate] = useState(todayWIB());
  const [exportStatus, setExportStatus] = useState<PurchaseRequestStatus | "">(
    "",
  );
  const [exporting, setExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportFieldErrors, setExportFieldErrors] = useState<
    Record<string, string>
  >({});

  const { dateFrom, dateTo } = dateRange;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await purchaseRequestsAdminApi.list({
        page,
        perPage: PER_PAGE,
        status,
        dateFrom,
        dateTo,
      });
      setPurchases(res.data ?? []);
      setTotal(res.meta?.total ?? 0);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to load purchase requests",
      );
      setPurchases([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, status, dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleStatusChange = (value: string) => {
    setStatus(value as PurchaseRequestStatus | "");
    setPage(1);
  };

  const handleDateRangeChange = (value: HistoryDateRangeValue) => {
    setDateRange(value);
    setPage(1);
  };

  const handleExport = async () => {
    setExporting(true);
    setExportFieldErrors({});
    try {
      const { blob, filename } = await exportPurchaseRequestsCsv({
        transactionDate: exportTransactionDate,
        status: exportStatus || undefined,
      });
      downloadPurchaseRequestsCsv(blob, {
        filename,
        date: new Date(`${exportTransactionDate}T00:00:00`),
      });
      toast.success("Purchase requests CSV exported");
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setExportFieldErrors(err.fields);
      }
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to export purchase requests CSV",
      );
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Purchases</h2>
          <p className="text-muted-foreground">{total} total</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <HistoryDateRangeFilter
            value={dateRange}
            onChange={handleDateRangeChange}
            presetTestId="purchases-date-preset"
            dateFromTestId="purchases-date-from"
            dateToTestId="purchases-date-to"
            presetAriaLabel="Transaction date"
            dateFromAriaLabel="Transaction date from"
            dateToAriaLabel="Transaction date to"
          />
          <Select
            aria-label="Filter by status"
            className="w-full sm:w-44"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
          />
          {canImport ? (
            <Button
              variant="outline"
              onClick={() => setImportOpen(true)}
              data-testid="open-import-dialog"
            >
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
          ) : null}
          <Link
            href="/admin/purchases/smart"
            className={buttonVariants({ variant: "outline" })}
            data-testid="smart-purchase-request-link"
          >
            <Sparkles className="h-4 w-4" />
            Smart Request
          </Link>
          <Link href="/admin/purchases/new" className={buttonVariants()}>
            <Plus className="h-4 w-4" />
            New purchase request
          </Link>
        </div>
      </div>

      {canExport && (
        <Card className="p-4" data-testid="purchase-export-section">
          <h3 className="text-sm font-medium">Export CSV</h3>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full sm:w-auto">
              <Label htmlFor="export-transaction-date">Transaction date</Label>
              <Input
                id="export-transaction-date"
                type="date"
                value={exportTransactionDate}
                onChange={(e) => {
                  setExportTransactionDate(e.target.value);
                  setExportFieldErrors((current) => {
                    const next = { ...current };
                    delete next.transaction_date;
                    return next;
                  });
                }}
                className="mt-2"
                aria-invalid={Boolean(exportFieldErrors.transaction_date)}
                data-testid="export-transaction-date"
              />
              {exportFieldErrors.transaction_date && (
                <p className="text-destructive mt-1 text-sm">
                  {exportFieldErrors.transaction_date}
                </p>
              )}
            </div>
            <div className="w-full sm:w-44">
              <Label htmlFor="export-status">State</Label>
              <Select
                id="export-status"
                aria-label="Export status filter"
                className="mt-2"
                options={EXPORT_STATUS_OPTIONS}
                value={exportStatus}
                onChange={(e) => {
                  setExportStatus(e.target.value as PurchaseRequestStatus | "");
                  setExportFieldErrors((current) => {
                    const next = { ...current };
                    delete next.status;
                    return next;
                  });
                }}
                data-testid="export-status"
              />
              {exportFieldErrors.status && (
                <p className="text-destructive mt-1 text-sm">
                  {exportFieldErrors.status}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              isLoading={exporting}
              onClick={() => void handleExport()}
              data-testid="export-purchase-requests"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </Card>
      )}

      <PurchaseImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => void load()}
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Transaction date</th>
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Created by</th>
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
              ) : purchases.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No purchase requests found.
                  </td>
                </tr>
              ) : (
                purchases.map((purchase) => (
                  <tr
                    key={purchase.id}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30"
                    onClick={() =>
                      router.push(`/admin/purchases/${purchase.id}`)
                    }
                  >
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(
                        purchase.transaction_date ?? purchase.created_at,
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {purchase.supplier_name}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={purchaseStatusBadgeVariant(purchase.status)}>
                        {purchase.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{purchase.item_count}</td>
                    <td className="px-4 py-3 font-medium">
                      {formatPurchaseSummaryTotal(purchase)}
                    </td>
                    <td className="px-4 py-3">
                      {purchase.created_by_username ?? "—"}
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

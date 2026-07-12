"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { productionRequestsAdminApi } from "@/lib/api/production-requests";
import { ApiError } from "@/lib/api/client";
import type {
  ProductionRequestStatus,
  ProductionRequestSummary,
} from "@/lib/api/types";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";

const PER_PAGE = 10;

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "REQUESTED", label: "REQUESTED" },
  { value: "ACCEPTED", label: "ACCEPTED" },
  { value: "READY_TO_PICK", label: "READY_TO_PICK" },
  { value: "DONE", label: "DONE" },
];

function productionStatusBadgeVariant(
  status: ProductionRequestStatus,
): NonNullable<BadgeProps["variant"]> {
  switch (status) {
    case "REQUESTED":
      return "secondary";
    case "ACCEPTED":
      return "default";
    case "READY_TO_PICK":
      return "warning";
    case "DONE":
      return "success";
    default:
      return "secondary";
  }
}

export default function AdminProductionRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<ProductionRequestSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ProductionRequestStatus | "">("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productionRequestsAdminApi.list({
        page,
        perPage: PER_PAGE,
        status,
      });
      setRequests(res.data ?? []);
      setTotal(res.meta?.total ?? 0);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to load production requests",
      );
      setRequests([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleStatusChange = (value: string) => {
    setStatus(value as ProductionRequestStatus | "");
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Production requests</h2>
          <p className="text-muted-foreground">{total} total</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select
            aria-label="Filter by status"
            className="w-full sm:w-44"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
          />
          <Link
            href="/admin/production-requests/new"
            className={buttonVariants()}
          >
            <Plus className="h-4 w-4" />
            New production request
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium">Producibility</th>
                <th className="px-4 py-3 font-medium">Created by</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : requests.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No production requests found.
                  </td>
                </tr>
              ) : (
                requests.map((request) => (
                  <tr
                    key={request.id}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30"
                    onClick={() =>
                      router.push(`/admin/production-requests/${request.id}`)
                    }
                  >
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(request.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={productionStatusBadgeVariant(request.status)}
                      >
                        {request.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{request.item_count}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          request.is_fully_producible ? "success" : "destructive"
                        }
                      >
                        {request.is_fully_producible ? "Producible" : "Shortage"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {request.created_by_username ?? "—"}
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

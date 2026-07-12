"use client";

import { useCallback, useEffect, useState } from "react";
import { cogsAdminApi } from "@/lib/api/cogs";
import { ApiError } from "@/lib/api/client";
import type { CogsMenuDetail } from "@/lib/api/types";
import {
  COGS_STATUS_LABELS,
  cogsStatusBadgeClass,
} from "@/lib/cogs-status";
import { toast } from "sonner";
import { CogsDetailContent } from "@/components/admin/cogs-detail-content";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface CogsDetailDialogProps {
  menuId: string | null;
  onClose: () => void;
}

export function CogsDetailDialog({ menuId, onClose }: CogsDetailDialogProps) {
  const [detail, setDetail] = useState<CogsMenuDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await cogsAdminApi.get(id);
      setDetail(res.data ?? null);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load COGS detail";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!menuId) {
      setDetail(null);
      setError(null);
      return;
    }
    void load(menuId);
  }, [menuId, load]);

  return (
    <Dialog
      open={menuId !== null}
      onClose={onClose}
      className="max-h-[90vh] max-w-5xl overflow-y-auto"
    >
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
          <Skeleton className="h-48 w-full" />
        </div>
      ) : error ? (
        <>
          <DialogTitle>COGS detail</DialogTitle>
          <p className="mt-4 text-center text-destructive">{error}</p>
        </>
      ) : detail ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <DialogTitle>{detail.title}</DialogTitle>
              <DialogDescription>{detail.category_name}</DialogDescription>
            </div>
            <Badge className={cogsStatusBadgeClass(detail.status)}>
              {COGS_STATUS_LABELS[detail.status]}
            </Badge>
          </div>

          <div className="mt-6">
            <CogsDetailContent detail={detail} />
          </div>
        </>
      ) : null}
    </Dialog>
  );
}

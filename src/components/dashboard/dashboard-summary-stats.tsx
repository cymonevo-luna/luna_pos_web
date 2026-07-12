"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Receipt,
  TrendingUp,
  Users,
  Truck,
  ShoppingCart,
} from "lucide-react";
import { transactionsAdminApi } from "@/lib/api/transactions";
import { adminApi } from "@/lib/api/users";
import { suppliersAdminApi } from "@/lib/api/suppliers";
import { purchaseRequestsAdminApi } from "@/lib/api/purchase-requests";
import type { MerchantRole } from "@/lib/api/types";
import { formatRupiah } from "@/lib/utils";
import { StatCard } from "@/components/dashboard/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

const PLACEHOLDER = "—";

function formatDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function sumBucketAmounts(
  buckets: { total_amount: number }[] | undefined,
): number {
  return (buckets ?? []).reduce((sum, bucket) => sum + bucket.total_amount, 0);
}

function sumBucketCounts(buckets: { count: number }[] | undefined): number {
  return (buckets ?? []).reduce((sum, bucket) => sum + bucket.count, 0);
}

interface ManagerStats {
  todayRevenue: number | null;
  todayTransactions: number | null;
  last30DaysRevenue: number | null;
}

interface AdminStats {
  totalUsers: number | null;
}

interface OperationalStats {
  suppliers: number | null;
  purchaseRequests: number | null;
}

interface DashboardSummaryStatsProps {
  roles: MerchantRole[];
}

function StatCardSkeleton() {
  return (
    <Card className="p-4" data-testid="summary-stat-skeleton">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <Skeleton className="mt-3 h-8 w-24" />
      <Skeleton className="mt-2 h-4 w-32" />
    </Card>
  );
}

export function DashboardSummaryStats({ roles }: DashboardSummaryStatsProps) {
  const isManager = roles.includes("manager");
  const isAdmin = roles.includes("admin");
  const isOperational = roles.includes("operational");

  const cardCount = useMemo(() => {
    let count = 0;
    if (isManager) count += 3;
    if (isAdmin) count += 1;
    if (isOperational) count += 2;
    return count;
  }, [isManager, isAdmin, isOperational]);

  const [loading, setLoading] = useState(cardCount > 0);
  const [managerStats, setManagerStats] = useState<ManagerStats>({
    todayRevenue: null,
    todayTransactions: null,
    last30DaysRevenue: null,
  });
  const [adminStats, setAdminStats] = useState<AdminStats>({
    totalUsers: null,
  });
  const [operationalStats, setOperationalStats] = useState<OperationalStats>({
    suppliers: null,
    purchaseRequests: null,
  });

  useEffect(() => {
    if (cardCount === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);

      const today = formatDateInput(new Date());
      const tasks: Promise<void>[] = [];

      if (isManager) {
        tasks.push(
          transactionsAdminApi
            .summary({ period: "daily", dateFrom: today, dateTo: today })
            .then((res) => {
              if (cancelled) return;
              const buckets = res.data?.buckets;
              setManagerStats((prev) => ({
                ...prev,
                todayRevenue: sumBucketAmounts(buckets),
                todayTransactions: sumBucketCounts(buckets),
              }));
            })
            .catch(() => {
              if (cancelled) return;
              setManagerStats((prev) => ({
                ...prev,
                todayRevenue: null,
                todayTransactions: null,
              }));
            }),
          transactionsAdminApi
            .summary({ period: "daily" })
            .then((res) => {
              if (cancelled) return;
              setManagerStats((prev) => ({
                ...prev,
                last30DaysRevenue: sumBucketAmounts(res.data?.buckets),
              }));
            })
            .catch(() => {
              if (cancelled) return;
              setManagerStats((prev) => ({
                ...prev,
                last30DaysRevenue: null,
              }));
            }),
        );
      }

      if (isAdmin) {
        tasks.push(
          adminApi
            .listUsers({ page: 1, perPage: 1 })
            .then((res) => {
              if (cancelled) return;
              setAdminStats({ totalUsers: res.meta?.total ?? 0 });
            })
            .catch(() => {
              if (cancelled) return;
              setAdminStats({ totalUsers: null });
            }),
        );
      }

      if (isOperational) {
        tasks.push(
          suppliersAdminApi
            .list({ page: 1, perPage: 1 })
            .then((res) => {
              if (cancelled) return;
              setOperationalStats((prev) => ({
                ...prev,
                suppliers: res.meta?.total ?? 0,
              }));
            })
            .catch(() => {
              if (cancelled) return;
              setOperationalStats((prev) => ({
                ...prev,
                suppliers: null,
              }));
            }),
          purchaseRequestsAdminApi
            .list({ page: 1, perPage: 1 })
            .then((res) => {
              if (cancelled) return;
              setOperationalStats((prev) => ({
                ...prev,
                purchaseRequests: res.meta?.total ?? 0,
              }));
            })
            .catch(() => {
              if (cancelled) return;
              setOperationalStats((prev) => ({
                ...prev,
                purchaseRequests: null,
              }));
            }),
        );
      }

      await Promise.all(tasks);

      if (!cancelled) {
        setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [cardCount, isManager, isAdmin, isOperational]);

  if (cardCount === 0) {
    return null;
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cardCount }, (_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {isManager && (
        <>
          <StatCard
            label="Today's revenue"
            value={
              managerStats.todayRevenue == null
                ? PLACEHOLDER
                : formatRupiah(managerStats.todayRevenue)
            }
            icon={Banknote}
            color="green"
          />
          <StatCard
            label="Today's transactions"
            value={
              managerStats.todayTransactions == null
                ? PLACEHOLDER
                : managerStats.todayTransactions
            }
            icon={Receipt}
            color="blue"
          />
          <StatCard
            label="Last 30 days revenue"
            value={
              managerStats.last30DaysRevenue == null
                ? PLACEHOLDER
                : formatRupiah(managerStats.last30DaysRevenue)
            }
            icon={TrendingUp}
            color="purple"
          />
        </>
      )}
      {isAdmin && (
        <StatCard
          label="Total users"
          value={
            adminStats.totalUsers == null ? PLACEHOLDER : adminStats.totalUsers
          }
          icon={Users}
          color="blue"
        />
      )}
      {isOperational && (
        <>
          <StatCard
            label="Suppliers"
            value={
              operationalStats.suppliers == null
                ? PLACEHOLDER
                : operationalStats.suppliers
            }
            icon={Truck}
            color="teal"
          />
          <StatCard
            label="Purchase requests"
            value={
              operationalStats.purchaseRequests == null
                ? PLACEHOLDER
                : operationalStats.purchaseRequests
            }
            icon={ShoppingCart}
            color="amber"
          />
        </>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import {
  cogsAdminApi,
  downloadCogsCsv,
  type CogsSortBy,
  type CogsSortOrder,
} from "@/lib/api/cogs";
import { categoriesAdminApi } from "@/lib/api/categories";
import { ApiError } from "@/lib/api/client";
import type { Category, CogsMenuSummary } from "@/lib/api/types";
import {
  COGS_STATUS_LABELS,
  cogsStatusBadgeClass,
  cogsStatusRowClass,
} from "@/lib/cogs-status";
import { formatRupiah } from "@/lib/utils";
import { toast } from "sonner";
import { CogsDetailDialog } from "@/components/admin/cogs-detail-dialog";
import { SortableTableHeader } from "@/components/admin/sortable-table-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PER_PAGE = 10;
const CATEGORY_FETCH_PER_PAGE = 100;

function formatPercent(value: number) {
  return `${value}%`;
}

function formatMoney(value: number | null | undefined) {
  if (value == null) return "—";
  return formatRupiah(value);
}

export default function AdminCogsPage() {
  const [items, setItems] = useState<CogsMenuSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortBy, setSortBy] = useState<CogsSortBy | undefined>();
  const [sortOrder, setSortOrder] = useState<CogsSortOrder>("asc");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [search]);

  const loadCategories = useCallback(async () => {
    try {
      const res = await categoriesAdminApi.list({
        page: 1,
        perPage: CATEGORY_FETCH_PER_PAGE,
      });
      setCategories(res.data ?? []);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load categories",
      );
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await cogsAdminApi.list({
        page,
        perPage: PER_PAGE,
        search: debounced,
        categoryId: categoryFilter,
        ...(sortBy ? { sortBy, sortOrder } : {}),
      });
      setItems(res.data ?? []);
      setTotal(res.meta?.total ?? 0);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load COGS data",
      );
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, debounced, categoryFilter, sortBy, sortOrder]);

  const handleSort = (column: CogsSortBy) => {
    setPage(1);
    if (sortBy === column) {
      setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortOrder("asc");
  };

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCategoryFilterChange = (value: string) => {
    setCategoryFilter(value);
    setPage(1);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await cogsAdminApi.exportCsv();
      downloadCogsCsv(blob);
      toast.success("COGS CSV exported");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to export COGS CSV",
      );
    } finally {
      setExporting(false);
    }
  };

  const categoryOptions = [
    { value: "", label: "All categories" },
    ...categories.map((category) => ({
      value: category.id,
      label: category.name,
    })),
  ];

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">COGS</h2>
          <p className="text-muted-foreground">{total} total</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search menus"
              placeholder="Search menus…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            aria-label="Filter by category"
            className="w-full sm:w-44"
            options={categoryOptions}
            value={categoryFilter}
            onChange={(e) => handleCategoryFilterChange(e.target.value)}
          />
          <Button
            variant="outline"
            onClick={() => void handleExport()}
            isLoading={exporting}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">
                  <SortableTableHeader
                    label="Menu"
                    sortKey="menu_title"
                    activeSortBy={sortBy}
                    activeSortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">COGS/piece</th>
                <th className="px-4 py-3 font-medium">
                  <SortableTableHeader
                    label="Margin %"
                    sortKey="margin"
                    activeSortBy={sortBy}
                    activeSortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 font-medium">VAT %</th>
                <th className="px-4 py-3 font-medium">Price after margin</th>
                <th className="px-4 py-3 font-medium">Price after VAT</th>
                <th className="px-4 py-3 font-medium">Recommended offline</th>
                <th className="px-4 py-3 font-medium">Recommended online</th>
                <th className="px-4 py-3 font-medium">
                  <SortableTableHeader
                    label="Current sell price"
                    sortKey="current_sell_price"
                    activeSortBy={sortBy}
                    activeSortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 font-medium">
                  <SortableTableHeader
                    label="Status"
                    sortKey="status"
                    activeSortBy={sortBy}
                    activeSortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 11 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No menus found.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.menu_id}
                    className={`cursor-pointer border-b border-border last:border-0 hover:bg-muted/30 ${cogsStatusRowClass(item.status)}`}
                    onClick={() => setSelectedMenuId(item.menu_id)}
                  >
                    <td className="px-4 py-3 font-medium">{item.title}</td>
                    <td className="px-4 py-3">{item.category_name}</td>
                    <td className="px-4 py-3">{formatMoney(item.cogs_per_piece)}</td>
                    <td className="px-4 py-3">
                      {formatPercent(item.margin_percent)}
                    </td>
                    <td className="px-4 py-3">
                      {formatPercent(item.vat_percent)}
                    </td>
                    <td className="px-4 py-3">
                      {formatMoney(item.price_after_margin)}
                    </td>
                    <td className="px-4 py-3">
                      {formatMoney(item.price_after_vat)}
                    </td>
                    <td className="px-4 py-3">
                      {formatMoney(item.recommended_offline)}
                    </td>
                    <td className="px-4 py-3">
                      {formatMoney(item.recommended_online)}
                    </td>
                    <td className="px-4 py-3">{formatRupiah(item.sell_price)}</td>
                    <td className="px-4 py-3">
                      <Badge className={cogsStatusBadgeClass(item.status)}>
                        {COGS_STATUS_LABELS[item.status]}
                      </Badge>
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

      <CogsDetailDialog
        menuId={selectedMenuId}
        onClose={() => setSelectedMenuId(null)}
      />
    </div>
  );
}

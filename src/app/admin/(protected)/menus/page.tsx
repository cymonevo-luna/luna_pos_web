"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  ChefHat,
} from "lucide-react";
import {
  menusAdminApi,
  menuBasicFormToPayload,
  menuFullFormToPayload,
  normalizeMenuPhotoFormValue,
  type MenuSortBy,
  type MenuSortOrder,
} from "@/lib/api/menus";
import { ApiError } from "@/lib/api/client";
import type { Menu } from "@/lib/api/types";
import type { MenuBasicFormValues } from "@/lib/validations";
import { MENU_COGS_DEFAULTS } from "@/lib/menu-cogs";
import { formatRupiah, menuPhotoUrl } from "@/lib/utils";
import { toast } from "sonner";
import { useCategoriesListQuery } from "@/lib/query/hooks/use-categories-list";
import { useMenusListQuery } from "@/lib/query/hooks/use-menus-list";
import { queryKeys } from "@/lib/query/keys";
import { MenuForm, type MenuFormHandle } from "@/components/admin/menu-form";
import { SortableTableHeader } from "@/components/admin/sortable-table-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

const PER_PAGE = 10;
const CATEGORY_FETCH_PER_PAGE = 100;

type MenuDialogState =
  | { mode: "create" }
  | { mode: "edit"; menu: Menu }
  | null;

function menuToFormValues(menu: Menu): Partial<MenuBasicFormValues> {
  return {
    title: menu.title,
    description: menu.description ?? "",
    category_id: menu.category_id,
    photo_url: normalizeMenuPhotoFormValue(menu.photo_url),
    available_stock: menu.available_stock,
    sell_price: menu.sell_price,
  };
}

function MenuPhotoThumbnail({ photoUrl }: { photoUrl?: string | null }) {
  return (
    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={menuPhotoUrl(photoUrl)}
        alt=""
        className="h-full w-full object-cover"
        onError={(event) => {
          event.currentTarget.src = menuPhotoUrl(null);
        }}
      />
    </div>
  );
}

export default function AdminMenusPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortBy, setSortBy] = useState<MenuSortBy | undefined>();
  const [sortOrder, setSortOrder] = useState<MenuSortOrder>("asc");
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Menu | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dialog, setDialog] = useState<MenuDialogState>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<MenuFormHandle>(null);

  const categoriesQuery = useCategoriesListQuery({
    page: 1,
    perPage: CATEGORY_FETCH_PER_PAGE,
  });
  const categories = categoriesQuery.data?.data ?? [];
  const categoriesLoading = categoriesQuery.isLoading;

  const menusQuery = useMenusListQuery({
    page,
    perPage: PER_PAGE,
    search: debounced,
    categoryId: categoryFilter,
    ...(sortBy ? { sortBy, sortOrder } : {}),
  });
  const menus = menusQuery.data?.data ?? [];
  const total = menusQuery.data?.meta?.total ?? 0;
  const loading = menusQuery.isLoading;

  const hasCategories = categories.length > 0;

  useEffect(() => {
    if (menusQuery.isError) {
      setError(
        menusQuery.error instanceof ApiError
          ? menusQuery.error.message
          : "Failed to load menus",
      );
    } else {
      setError(null);
    }
  }, [menusQuery.isError, menusQuery.error]);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [search]);

  const invalidateMenus = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.menus.lists() });
  }, [queryClient]);

  const handleCategoryFilterChange = (value: string) => {
    setCategoryFilter(value);
    setPage(1);
  };

  const handleSort = (column: MenuSortBy) => {
    setPage(1);
    if (sortBy === column) {
      setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortOrder("asc");
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await menusAdminApi.delete(pendingDelete.id);
      toast.success("Menu deleted");
      setPendingDelete(null);
      invalidateMenus();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete menu",
      );
    } finally {
      setDeleting(false);
    }
  };

  const closeDialog = () => {
    if (saving) return;
    setDialog(null);
  };

  const openDialog = (nextDialog: MenuDialogState) => {
    setDialog(nextDialog);
  };

  const handleFormSubmit = async (values: MenuBasicFormValues) => {
    if (!dialog) return;
    setSaving(true);
    try {
      const payload =
        dialog.mode === "create"
          ? {
              ...menuBasicFormToPayload(values),
              ...MENU_COGS_DEFAULTS,
            }
          : menuFullFormToPayload(values, {
              recipe_yield:
                dialog.menu.recipe_yield ?? MENU_COGS_DEFAULTS.recipe_yield,
              margin_percent:
                dialog.menu.margin_percent ?? MENU_COGS_DEFAULTS.margin_percent,
              vat_percent:
                dialog.menu.vat_percent ?? MENU_COGS_DEFAULTS.vat_percent,
            });
      if (dialog.mode === "create") {
        await menusAdminApi.create(payload);
        toast.success("Menu created");
      } else {
        await menusAdminApi.update(dialog.menu.id, payload);
        toast.success("Menu updated");
      }
      setDialog(null);
      invalidateMenus();
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        formRef.current?.applyServerErrors(err.fields);
      }
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save menu",
      );
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const dialogTitle = dialog?.mode === "edit" ? "Edit menu" : "Add menu";

  const formDefaultValues =
    dialog?.mode === "edit" ? menuToFormValues(dialog.menu) : undefined;

  const categoryFilterOptions = [
    { value: "", label: "All categories" },
    ...categories.map((category) => ({
      value: category.id,
      label: category.name,
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Menus</h2>
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
            />
          </div>
          <Select
            aria-label="Filter by category"
            className="w-full sm:w-48"
            options={categoryFilterOptions}
            value={categoryFilter}
            onChange={(e) => handleCategoryFilterChange(e.target.value)}
            disabled={categoriesLoading}
          />
          <Button
            onClick={() => openDialog({ mode: "create" })}
            disabled={!hasCategories || categoriesLoading}
          >
            <Plus className="h-4 w-4" />
            Add Menu
          </Button>
        </div>
      </div>

      {!categoriesLoading && !hasCategories && (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          Create a category before adding menu items.{" "}
          <Link href="/admin/categories" className="font-medium underline">
            Go to Categories
          </Link>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Photo</th>
                <th className="px-4 py-3 font-medium">
                  <SortableTableHeader
                    label="Title"
                    sortKey="title"
                    activeSortBy={sortBy}
                    activeSortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">
                  <SortableTableHeader
                    label="Stock"
                    sortKey="stock"
                    activeSortBy={sortBy}
                    activeSortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
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
              ) : error ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-destructive"
                  >
                    {error}
                  </td>
                </tr>
              ) : menus.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No menus found.
                  </td>
                </tr>
              ) : (
                menus.map((menu) => (
                  <tr
                    key={menu.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <MenuPhotoThumbnail photoUrl={menu.photo_url} />
                    </td>
                    <td className="px-4 py-3 font-medium">{menu.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {menu.category_name}
                    </td>
                    <td className="px-4 py-3">{menu.available_stock}</td>
                    <td className="px-4 py-3">{formatRupiah(menu.sell_price)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/menus/${menu.id}/ingredients`}
                          className={buttonVariants({
                            variant: "ghost",
                            size: "icon",
                            className: "h-8 w-8",
                          })}
                          aria-label="Manage ingredients"
                        >
                          <ChefHat className="h-4 w-4" />
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Edit menu"
                          onClick={() => openDialog({ mode: "edit", menu })}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          aria-label="Delete menu"
                          onClick={() => setPendingDelete(menu)}
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

      <Dialog
        open={dialog !== null}
        onClose={closeDialog}
        className="max-h-[90vh] max-w-xl overflow-y-auto"
      >
        <DialogTitle>{dialogTitle}</DialogTitle>
        {dialog && (
          <>
            <MenuForm
              key={dialog.mode === "edit" ? `edit-${dialog.menu.id}` : "create"}
              ref={formRef}
              categories={categories}
              defaultValues={formDefaultValues}
              onSubmit={handleFormSubmit}
              onCancel={closeDialog}
              isLoading={saving}
              submitLabel={dialog.mode === "edit" ? "Save changes" : "Add Menu"}
            />
            {dialog.mode === "create" && (
              <div className="text-muted-foreground border-t border-border pt-4 text-sm">
                After saving, use Manage ingredients in the menu list to
                configure the formula.
              </div>
            )}
          </>
        )}
      </Dialog>

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold">Delete menu</h3>
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

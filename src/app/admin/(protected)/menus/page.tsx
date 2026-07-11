"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
} from "lucide-react";
import { menusAdminApi, menuFormToPayload } from "@/lib/api/menus";
import { categoriesAdminApi } from "@/lib/api/categories";
import { ApiError } from "@/lib/api/client";
import type { Category, Menu } from "@/lib/api/types";
import type { MenuFormValues } from "@/lib/validations";
import { formatRupiah, menuPhotoUrl } from "@/lib/utils";
import { toast } from "sonner";
import { MenuForm, type MenuFormHandle } from "@/components/admin/menu-form";
import { MenuIngredientsForm } from "@/components/admin/menu-ingredients-form";
import { Button } from "@/components/ui/button";
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

function menuToFormValues(menu: Menu): Partial<MenuFormValues> {
  return {
    title: menu.title,
    description: menu.description ?? "",
    category_id: menu.category_id,
    photo_url: menu.photo_url ?? "",
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
  const [menus, setMenus] = useState<Menu[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Menu | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dialog, setDialog] = useState<MenuDialogState>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<MenuFormHandle>(null);

  const hasCategories = categories.length > 0;

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [search]);

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const res = await categoriesAdminApi.list({
        page: 1,
        perPage: CATEGORY_FETCH_PER_PAGE,
      });
      setCategories(res.data ?? []);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to load categories",
      );
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await menusAdminApi.list({
        page,
        perPage: PER_PAGE,
        search: debounced,
        categoryId: categoryFilter,
      });
      setMenus(res.data ?? []);
      setTotal(res.meta?.total ?? 0);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load menus",
      );
    } finally {
      setLoading(false);
    }
  }, [page, debounced, categoryFilter]);

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

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await menusAdminApi.delete(pendingDelete.id);
      toast.success("Menu deleted");
      setPendingDelete(null);
      void load();
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

  const handleFormSubmit = async (values: MenuFormValues) => {
    if (!dialog) return;
    setSaving(true);
    try {
      const payload = menuFormToPayload(values);
      if (dialog.mode === "create") {
        await menusAdminApi.create(payload);
        toast.success("Menu created");
      } else {
        await menusAdminApi.update(dialog.menu.id, payload);
        toast.success("Menu updated");
      }
      setDialog(null);
      void load();
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
            onClick={() => setDialog({ mode: "create" })}
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
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Stock</th>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Edit menu"
                          onClick={() => setDialog({ mode: "edit", menu })}
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
        className={dialog?.mode === "edit" ? "max-w-3xl" : "max-w-lg"}
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
            {dialog.mode === "edit" ? (
              <MenuIngredientsForm menuId={dialog.menu.id} disabled={saving} />
            ) : (
              <div className="text-muted-foreground border-t border-border pt-4 text-sm">
                Save the menu first to add an ingredient formula.
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

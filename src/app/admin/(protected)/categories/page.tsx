"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
} from "lucide-react";
import {
  categoriesAdminApi,
  categoryFormToPayload,
} from "@/lib/api/categories";
import { ApiError } from "@/lib/api/client";
import type { Category } from "@/lib/api/types";
import type { CategoryFormValues } from "@/lib/validations";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import {
  CategoryForm,
  type CategoryFormHandle,
} from "@/components/admin/category-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

const PER_PAGE = 10;

type CategoryDialogState =
  | { mode: "create" }
  | { mode: "edit"; category: Category }
  | null;

function categoryToFormValues(
  category: Category,
): Partial<CategoryFormValues> {
  return {
    name: category.name,
  };
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dialog, setDialog] = useState<CategoryDialogState>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<CategoryFormHandle>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await categoriesAdminApi.list({
        page,
        perPage: PER_PAGE,
        search: debounced,
      });
      setCategories(res.data ?? []);
      setTotal(res.meta?.total ?? 0);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load categories",
      );
    } finally {
      setLoading(false);
    }
  }, [page, debounced]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await categoriesAdminApi.delete(pendingDelete.id);
      toast.success("Category deleted");
      setPendingDelete(null);
      void load();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to delete category",
      );
    } finally {
      setDeleting(false);
    }
  };

  const closeDialog = () => {
    if (saving) return;
    setDialog(null);
  };

  const handleFormSubmit = async (values: CategoryFormValues) => {
    if (!dialog) return;
    setSaving(true);
    try {
      const payload = categoryFormToPayload(values);
      if (dialog.mode === "create") {
        await categoriesAdminApi.create(payload);
        toast.success("Category created");
      } else {
        await categoriesAdminApi.update(dialog.category.id, payload);
        toast.success("Category updated");
      }
      setDialog(null);
      void load();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields) {
          formRef.current?.applyServerErrors(err.fields);
        } else if (err.status === 409) {
          formRef.current?.applyServerErrors({ name: err.message });
        }
        toast.error(err.message);
      } else {
        toast.error("Failed to save category");
      }
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const dialogTitle =
    dialog?.mode === "edit" ? "Edit category" : "Add category";

  const formDefaultValues =
    dialog?.mode === "edit"
      ? categoryToFormValues(dialog.category)
      : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Menu Categories</h2>
          <p className="text-muted-foreground">{total} total</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => setDialog({ mode: "create" })}>
            <Plus className="h-4 w-4" />
            Add Category
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 3 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-10 text-center text-destructive"
                  >
                    {error}
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No categories found.
                  </td>
                </tr>
              ) : (
                categories.map((category) => (
                  <tr
                    key={category.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">{category.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(category.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Edit category"
                          onClick={() =>
                            setDialog({ mode: "edit", category })
                          }
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          aria-label="Delete category"
                          onClick={() => setPendingDelete(category)}
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

      <Dialog open={dialog !== null} onClose={closeDialog} className="max-w-lg">
        <DialogTitle>{dialogTitle}</DialogTitle>
        {dialog && (
          <CategoryForm
            key={
              dialog.mode === "edit"
                ? `edit-${dialog.category.id}`
                : "create"
            }
            ref={formRef}
            defaultValues={formDefaultValues}
            onSubmit={handleFormSubmit}
            onCancel={closeDialog}
            isLoading={saving}
            submitLabel={
              dialog.mode === "edit" ? "Save changes" : "Add Category"
            }
          />
        )}
      </Dialog>

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold">Delete category</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {pendingDelete.name}
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

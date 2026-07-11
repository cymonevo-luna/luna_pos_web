"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import {
  categoriesToIds,
  handleCategoryDragEnd,
} from "./category-reorder";

const PER_PAGE = 10;
const REORDER_PER_PAGE = 100;

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

interface SortableCategoryRowProps {
  category: Category;
  canReorder: boolean;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}

function SortableCategoryRow({
  category,
  canReorder,
  onEdit,
  onDelete,
}: SortableCategoryRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: category.id,
    disabled: !canReorder,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b border-border last:border-0 hover:bg-muted/30 ${
        isDragging ? "bg-muted/50 opacity-80" : ""
      }`}
    >
      <td className="w-10 px-2 py-3">
        {canReorder ? (
          <button
            type="button"
            ref={setActivatorNodeRef}
            className="flex h-8 w-8 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        ) : null}
      </td>
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
            onClick={() => onEdit(category)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            aria-label="Delete category"
            onClick={() => onDelete(category)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
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
  const [reordering, setReordering] = useState(false);
  const formRef = useRef<CategoryFormHandle>(null);

  const isSearchActive = debounced.trim().length > 0;
  const usePagination = isSearchActive || total > REORDER_PER_PAGE;
  const perPage = usePagination ? PER_PAGE : REORDER_PER_PAGE;
  const effectivePage = usePagination ? page : 1;
  const canReorder =
    !isSearchActive && total <= REORDER_PER_PAGE && !reordering && !loading;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

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
        page: effectivePage,
        perPage,
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
  }, [effectivePage, perPage, debounced]);

  useEffect(() => {
    void load();
  }, [load]);

  const onDragEnd = async (event: DragEndEvent) => {
    if (!canReorder || reordering) return;

    setReordering(true);
    try {
      await handleCategoryDragEnd(event, {
        categories,
        setCategories,
        reorder: (categoryIds) => categoriesAdminApi.reorder(categoryIds),
        onSuccess: () => toast.success("Category order saved"),
        onError: (message) => toast.error(message),
        reload: () => {
          void load();
        },
      });
    } finally {
      setReordering(false);
    }
  };

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

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const showPagination = usePagination && totalPages > 1;

  const dialogTitle =
    dialog?.mode === "edit" ? "Edit category" : "Add category";

  const formDefaultValues =
    dialog?.mode === "edit"
      ? categoryToFormValues(dialog.category)
      : undefined;

  const columnCount = 4;

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

      {isSearchActive ? (
        <p className="text-sm text-muted-foreground">
          Clear search to reorder categories.
        </p>
      ) : null}

      {!isSearchActive && total > REORDER_PER_PAGE ? (
        <p className="text-sm text-muted-foreground">
          Reordering is available when all categories fit on one page.
        </p>
      ) : null}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="w-10 px-2 py-3 font-medium">
                  {canReorder ? (
                    <span className="sr-only">Priority</span>
                  ) : null}
                </th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: columnCount }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td
                    colSpan={columnCount}
                    className="px-4 py-10 text-center text-destructive"
                  >
                    {error}
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td
                    colSpan={columnCount}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No categories found.
                  </td>
                </tr>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(event) => {
                    void onDragEnd(event);
                  }}
                >
                  <SortableContext
                    items={categoriesToIds(categories)}
                    strategy={verticalListSortingStrategy}
                  >
                    {categories.map((category) => (
                      <SortableCategoryRow
                        key={category.id}
                        category={category}
                        canReorder={canReorder}
                        onEdit={(item) =>
                          setDialog({ mode: "edit", category: item })
                        }
                        onDelete={setPendingDelete}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {showPagination ? (
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
      ) : null}

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

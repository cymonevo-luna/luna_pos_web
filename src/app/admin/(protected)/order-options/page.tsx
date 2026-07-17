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
  GripVertical,
  ChefHat,
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
  orderOptionsAdminApi,
  orderOptionFormToPayload,
} from "@/lib/api/order-options";
import { ApiError } from "@/lib/api/client";
import type { OrderOption } from "@/lib/api/types";
import type { OrderOptionFormValues } from "@/lib/validations";
import { toast } from "sonner";
import {
  OrderOptionForm,
  type OrderOptionFormHandle,
} from "@/components/admin/order-option-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import {
  orderOptionsToIds,
  handleOrderOptionDragEnd,
} from "./order-option-reorder";

const PER_PAGE = 10;
const REORDER_PER_PAGE = 100;

type OrderOptionDialogState =
  | { mode: "create" }
  | { mode: "edit"; orderOption: OrderOption }
  | null;

function orderOptionToFormValues(
  orderOption: OrderOption,
): Partial<OrderOptionFormValues> {
  return {
    name: orderOption.name,
  };
}

interface SortableOrderOptionRowProps {
  orderOption: OrderOption;
  canReorder: boolean;
  onEdit: (orderOption: OrderOption) => void;
  onDelete: (orderOption: OrderOption) => void;
}

function SortableOrderOptionRow({
  orderOption,
  canReorder,
  onEdit,
  onDelete,
}: SortableOrderOptionRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: orderOption.id,
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
      <td className="px-4 py-3 font-medium">{orderOption.name}</td>
      <td className="px-4 py-3 text-muted-foreground">{orderOption.priority}</td>
      <td className="px-4 py-3 text-muted-foreground">
        {orderOption.ingredient_count}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/admin/order-options/${orderOption.id}/ingredients`}
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
            aria-label="Edit order option"
            onClick={() => onEdit(orderOption)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            aria-label="Delete order option"
            onClick={() => onDelete(orderOption)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

export default function AdminOrderOptionsPage() {
  const [orderOptions, setOrderOptions] = useState<OrderOption[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<OrderOption | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dialog, setDialog] = useState<OrderOptionDialogState>(null);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const formRef = useRef<OrderOptionFormHandle>(null);

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
      const res = await orderOptionsAdminApi.list({
        page: effectivePage,
        perPage,
        search: debounced,
      });
      setOrderOptions(res.data ?? []);
      setTotal(res.meta?.total ?? 0);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to load order options",
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
      await handleOrderOptionDragEnd(event, {
        orderOptions,
        setOrderOptions,
        reorder: (orderOptionIds) =>
          orderOptionsAdminApi.reorder(orderOptionIds),
        onSuccess: () => toast.success("Order option priority saved"),
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
      await orderOptionsAdminApi.delete(pendingDelete.id);
      toast.success("Order option deleted");
      setPendingDelete(null);
      void load();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to delete order option",
      );
    } finally {
      setDeleting(false);
    }
  };

  const closeDialog = () => {
    if (saving) return;
    setDialog(null);
  };

  const handleFormSubmit = async (values: OrderOptionFormValues) => {
    if (!dialog) return;
    setSaving(true);
    try {
      const payload = orderOptionFormToPayload(values);
      if (dialog.mode === "create") {
        await orderOptionsAdminApi.create(payload);
        toast.success("Order option created");
      } else {
        await orderOptionsAdminApi.update(dialog.orderOption.id, payload);
        toast.success("Order option updated");
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
        toast.error("Failed to save order option");
      }
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const showPagination = usePagination && totalPages > 1;

  const dialogTitle =
    dialog?.mode === "edit" ? "Edit order option" : "Add order option";

  const formDefaultValues =
    dialog?.mode === "edit"
      ? orderOptionToFormValues(dialog.orderOption)
      : undefined;

  const columnCount = 5;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Order Options</h2>
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
            Add Order Option
          </Button>
        </div>
      </div>

      {isSearchActive ? (
        <p className="text-sm text-muted-foreground">
          Clear search to reorder order options.
        </p>
      ) : null}

      {!isSearchActive && total > REORDER_PER_PAGE ? (
        <p className="text-sm text-muted-foreground">
          Reordering is available when all order options fit on one page.
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
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Ingredients</th>
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
              ) : orderOptions.length === 0 ? (
                <tr>
                  <td
                    colSpan={columnCount}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No order options configured.
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
                    items={orderOptionsToIds(orderOptions)}
                    strategy={verticalListSortingStrategy}
                  >
                    {orderOptions.map((orderOption) => (
                      <SortableOrderOptionRow
                        key={orderOption.id}
                        orderOption={orderOption}
                        canReorder={canReorder}
                        onEdit={(item) =>
                          setDialog({ mode: "edit", orderOption: item })
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
          <OrderOptionForm
            key={
              dialog.mode === "edit"
                ? `edit-${dialog.orderOption.id}`
                : "create"
            }
            ref={formRef}
            defaultValues={formDefaultValues}
            onSubmit={handleFormSubmit}
            onCancel={closeDialog}
            isLoading={saving}
            submitLabel={
              dialog.mode === "edit" ? "Save changes" : "Add Order Option"
            }
          />
        )}
      </Dialog>

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold">Delete order option</h3>
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

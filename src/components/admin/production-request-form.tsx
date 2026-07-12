"use client";

import * as React from "react";
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import {
  productionRequestFormSchema,
  type ProductionRequestFormValues,
} from "@/lib/validations";
import { menusAdminApi } from "@/lib/api/menus";
import { ApiError } from "@/lib/api/client";
import type { Menu } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

type MenuOption = Pick<Menu, "id" | "title">;

function buildDefaultValues(
  defaultValues?: Partial<ProductionRequestFormValues>,
): ProductionRequestFormValues {
  return {
    items: defaultValues?.items ?? [],
    notes: defaultValues?.notes ?? "",
  };
}

function findDuplicateItemIndexes(items: ProductionRequestFormValues["items"]) {
  const seen = new Map<string, number>();
  const duplicates = new Set<number>();

  items.forEach((item, index) => {
    if (!item.menu_id) return;
    const firstIndex = seen.get(item.menu_id);
    if (firstIndex !== undefined) {
      duplicates.add(firstIndex);
      duplicates.add(index);
    } else {
      seen.set(item.menu_id, index);
    }
  });

  return duplicates;
}

function mergeMenuOptions(
  loaded: MenuOption[],
  fromItems: ProductionRequestFormValues["items"],
): MenuOption[] {
  const byId = new Map<string, MenuOption>();
  for (const menu of loaded) {
    byId.set(menu.id, menu);
  }
  for (const item of fromItems) {
    if (item.menu_id && !byId.has(item.menu_id)) {
      byId.set(item.menu_id, { id: item.menu_id, title: "Selected menu" });
    }
  }
  return Array.from(byId.values()).sort((a, b) =>
    a.title.localeCompare(b.title),
  );
}

export interface ProductionRequestFormProps {
  defaultValues?: Partial<ProductionRequestFormValues>;
  /** Preloaded menus skip the catalog fetch (e.g. operational edit). */
  menus?: MenuOption[];
  onSubmit: (values: ProductionRequestFormValues) => void | Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  submitLabel?: string;
  showCancel?: boolean;
}

export interface ProductionRequestFormHandle {
  applyServerErrors: (fields: Record<string, string>) => void;
  reset: (values?: Partial<ProductionRequestFormValues>) => void;
}

export const ProductionRequestForm = React.forwardRef<
  ProductionRequestFormHandle,
  ProductionRequestFormProps
>(function ProductionRequestForm(
  {
    defaultValues,
    menus: menusProp,
    onSubmit,
    onCancel,
    isLoading = false,
    submitLabel = "Save changes",
    showCancel = true,
  },
  ref,
) {
  const initialValuesRef = useRef(buildDefaultValues(defaultValues));
  const [menus, setMenus] = useState<MenuOption[]>(menusProp ?? []);
  const [menusLoading, setMenusLoading] = useState(!menusProp);
  const [menusError, setMenusError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    clearErrors,
    control,
    formState: { errors },
  } = useForm<ProductionRequestFormValues>({
    resolver: zodResolver(productionRequestFormSchema),
    defaultValues: initialValuesRef.current,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const watchedItems = watch("items");

  useEffect(() => {
    const values = buildDefaultValues(defaultValues);
    initialValuesRef.current = values;
    reset(values);
  }, [defaultValues, reset]);

  const loadMenus = useCallback(async () => {
    setMenusLoading(true);
    setMenusError(null);
    try {
      const result = await menusAdminApi.list({ page: 1, perPage: 200 });
      setMenus(
        mergeMenuOptions(result.data ?? [], initialValuesRef.current.items),
      );
    } catch (err) {
      setMenusError(
        err instanceof ApiError
          ? err.message
          : "Failed to load menus",
      );
      setMenus(mergeMenuOptions([], initialValuesRef.current.items));
    } finally {
      setMenusLoading(false);
    }
  }, []);

  useEffect(() => {
    if (menusProp) {
      setMenus(mergeMenuOptions(menusProp, initialValuesRef.current.items));
      setMenusLoading(false);
      setMenusError(null);
      return;
    }
    void loadMenus();
  }, [menusProp, loadMenus]);

  useImperativeHandle(ref, () => ({
    applyServerErrors(fields: Record<string, string>) {
      for (const [field, message] of Object.entries(fields)) {
        if (field === "notes") {
          setError(field, { message });
          continue;
        }

        const itemMatch = /^items(?:\[(\d+)\])?\.(.+)$/.exec(field);
        if (itemMatch) {
          const index = Number(itemMatch[1] ?? "0");
          const property = itemMatch[2];
          if (property === "menu_id" || property === "quantity") {
            setError(`items.${index}.${property}` as keyof ProductionRequestFormValues, {
              message,
            });
          }
          continue;
        }

        if (field === "items") {
          setError("items", { message });
        }
      }
    },
    reset(values?: Partial<ProductionRequestFormValues>) {
      const nextValues = buildDefaultValues({
        ...initialValuesRef.current,
        ...values,
      });
      reset(nextValues);
    },
  }));

  const selectedMenuIds = watchedItems
    .map((item) => item.menu_id)
    .filter((id) => id.length > 0);

  const duplicateIndexes = findDuplicateItemIndexes(watchedItems);

  const canAddItems = !menusLoading && !isLoading && menus.length > 0;

  const handleAddRow = () => {
    append({ menu_id: "", quantity: Number.NaN });
  };

  const handleFormSubmit = (values: ProductionRequestFormValues) => {
    const duplicates = findDuplicateItemIndexes(values.items);
    if (duplicates.size > 0) {
      duplicates.forEach((index) => {
        setError(`items.${index}.menu_id`, {
          message: "This menu is already selected",
        });
      });
      return;
    }
    void onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6" noValidate>
      <section aria-label="Line items" className="space-y-4">
        <div>
          <h4 className="text-base font-semibold">Line items</h4>
          <p className="text-muted-foreground text-sm">
            Specify menus and production quantities for this request.
          </p>
        </div>

        {menusLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : menusError ? (
          <div className="space-y-3">
            <p className="text-destructive text-sm">{menusError}</p>
            {!menusProp ? (
              <Button type="button" variant="outline" size="sm" onClick={() => void loadMenus()}>
                Retry
              </Button>
            ) : null}
          </div>
        ) : menus.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No menus available. Add menus before creating a production request.
          </p>
        ) : (
          <>
            {fields.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No line items yet. Add rows to build this production request.
              </p>
            ) : (
              <div className="space-y-3">
                {fields.map((field, index) => {
                  const item = watchedItems[index];
                  const itemErrors = errors.items?.[index];
                  const isDuplicate = duplicateIndexes.has(index);
                  const selectedMenu = menus.find((menu) => menu.id === item?.menu_id);

                  return (
                    <div
                      key={field.id}
                      className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_auto]"
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor={`production-item-${field.id}`}>
                          Item {index + 1}
                        </Label>
                        <select
                          id={`production-item-${field.id}`}
                          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 flex h-11 w-full rounded-xl border px-3.5 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                          value={item?.menu_id ?? ""}
                          disabled={isLoading}
                          onChange={(event) => {
                            const nextId = event.target.value;
                            setValue(`items.${index}.menu_id`, nextId, {
                              shouldValidate: true,
                            });
                            clearErrors(`items.${index}.menu_id`);
                          }}
                        >
                          <option value="">Select a menu</option>
                          {menus.map((menu) => {
                            const isSelectedElsewhere =
                              selectedMenuIds.includes(menu.id) &&
                              menu.id !== item?.menu_id;
                            return (
                              <option
                                key={menu.id}
                                value={menu.id}
                                disabled={isSelectedElsewhere}
                              >
                                {menu.title}
                              </option>
                            );
                          })}
                        </select>
                        {selectedMenu ? (
                          <p className="text-muted-foreground text-xs">
                            {selectedMenu.title}
                          </p>
                        ) : null}
                        {(itemErrors?.menu_id?.message || isDuplicate) && (
                          <p className="text-destructive text-sm">
                            {itemErrors?.menu_id?.message ??
                              "This menu is already selected"}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor={`production-quantity-${field.id}`}>
                          Quantity
                        </Label>
                        <Input
                          id={`production-quantity-${field.id}`}
                          type="number"
                          step="1"
                          min="1"
                          inputMode="numeric"
                          disabled={isLoading}
                          {...register(`items.${index}.quantity`, {
                            valueAsNumber: true,
                          })}
                        />
                        {itemErrors?.quantity?.message && (
                          <p className="text-destructive text-sm">
                            {itemErrors.quantity.message}
                          </p>
                        )}
                      </div>

                      <div className="flex items-end justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive h-11 w-11"
                          aria-label={`Remove item ${index + 1}`}
                          disabled={isLoading}
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {typeof errors.items?.message === "string" && (
              <p className="text-destructive text-sm">{errors.items.message}</p>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={handleAddRow}
              disabled={!canAddItems}
            >
              <Plus className="h-4 w-4" />
              Add line item
            </Button>
          </>
        )}
      </section>

      <div className="space-y-1.5">
        <Label htmlFor="production-request-notes">Notes (optional)</Label>
        <Textarea
          id="production-request-notes"
          rows={3}
          disabled={isLoading}
          {...register("notes")}
        />
        {errors.notes && (
          <p className="text-destructive text-sm">{errors.notes.message}</p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {showCancel && onCancel ? (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
        ) : null}
        <Button
          type="submit"
          isLoading={isLoading}
          disabled={fields.length === 0 || menusLoading}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
});

ProductionRequestForm.displayName = "ProductionRequestForm";

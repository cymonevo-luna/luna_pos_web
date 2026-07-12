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
import {
  productionRequestsAdminApi,
  productionRequestFormToPayload,
} from "@/lib/api/production-requests";
import { ApiError } from "@/lib/api/client";
import type {
  Menu,
  ProductionRequestEstimateResponse,
} from "@/lib/api/types";
import { ProductionAggregatedIngredientsTable } from "@/components/admin/production-aggregated-ingredients-table";
import { ProductionLineStockEstimation } from "@/components/admin/production-line-stock-estimation";
import { MenuPicker } from "@/components/admin/menu-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const ESTIMATE_DEBOUNCE_MS = 300;

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

function buildSelectedMenusFromDefaults(
  items: ProductionRequestFormValues["items"],
  preloadedMenus?: Pick<Menu, "id" | "title" | "category_name">[],
): Record<number, Pick<Menu, "id" | "title" | "category_name">> {
  const byId = new Map(
    (preloadedMenus ?? []).map((menu) => [menu.id, menu]),
  );
  const selected: Record<number, Pick<Menu, "id" | "title" | "category_name">> =
    {};

  items.forEach((item, index) => {
    if (!item.menu_id) return;
    const menu = byId.get(item.menu_id);
    if (menu) {
      selected[index] = menu;
    }
  });

  return selected;
}

function hasEstimatableItems(items: ProductionRequestFormValues["items"]) {
  return items.some(
    (item) =>
      item.menu_id &&
      Number.isInteger(item.quantity) &&
      item.quantity > 0,
  );
}

export interface ProductionRequestFormProps {
  defaultValues?: Partial<ProductionRequestFormValues>;
  /** Pre-seed menu labels for edit flows (e.g. operational detail). */
  preloadedMenus?: Pick<Menu, "id" | "title" | "category_name">[];
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
    preloadedMenus,
    onSubmit,
    onCancel,
    isLoading = false,
    submitLabel = "Create production request",
    showCancel = true,
  },
  ref,
) {
  const initialValuesRef = useRef(buildDefaultValues(defaultValues));
  const [selectedMenus, setSelectedMenus] = useState<
    Record<number, Pick<Menu, "id" | "title" | "category_name">>
  >(() =>
    buildSelectedMenusFromDefaults(
      buildDefaultValues(defaultValues).items,
      preloadedMenus,
    ),
  );
  const [estimate, setEstimate] = useState<ProductionRequestEstimateResponse | null>(
    null,
  );
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const estimateRequestIdRef = useRef(0);

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
    setSelectedMenus(
      buildSelectedMenusFromDefaults(values.items, preloadedMenus),
    );
    setEstimate(null);
    setEstimateError(null);
  }, [defaultValues, preloadedMenus, reset]);

  const runEstimate = useCallback(async (items: ProductionRequestFormValues["items"]) => {
    if (!hasEstimatableItems(items)) {
      setEstimate(null);
      setEstimateError(null);
      setEstimateLoading(false);
      return;
    }

    const requestId = ++estimateRequestIdRef.current;
    setEstimateLoading(true);
    setEstimateError(null);

    try {
      const payload = productionRequestFormToPayload({ items, notes: "" });
      const result = await productionRequestsAdminApi.estimate(payload);
      if (requestId !== estimateRequestIdRef.current) return;
      setEstimate(result.data);
    } catch (err) {
      if (requestId !== estimateRequestIdRef.current) return;
      setEstimate(null);
      setEstimateError(
        err instanceof ApiError
          ? err.message
          : "Failed to load stock estimation",
      );
    } finally {
      if (requestId === estimateRequestIdRef.current) {
        setEstimateLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void runEstimate(watchedItems);
    }, ESTIMATE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [watchedItems, runEstimate]);

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
      setSelectedMenus(
        buildSelectedMenusFromDefaults(nextValues.items, preloadedMenus),
      );
      setEstimate(null);
      setEstimateError(null);
    },
  }));

  const selectedMenuIds = watchedItems
    .map((item) => item.menu_id)
    .filter((id) => id.length > 0);

  const duplicateIndexes = findDuplicateItemIndexes(watchedItems);

  const handleMenuChange = (index: number, menu: Menu) => {
    setValue(`items.${index}.menu_id`, menu.id, { shouldValidate: true });
    clearErrors(`items.${index}.menu_id`);
    setSelectedMenus((current) => ({
      ...current,
      [index]: {
        id: menu.id,
        title: menu.title,
        category_name: menu.category_name,
      },
    }));
  };

  const handleRemoveRow = (index: number) => {
    remove(index);
    setSelectedMenus((current) => {
      const next: Record<number, Pick<Menu, "id" | "title" | "category_name">> =
        {};
      Object.entries(current).forEach(([key, menu]) => {
        const rowIndex = Number(key);
        if (rowIndex < index) {
          next[rowIndex] = menu;
        } else if (rowIndex > index) {
          next[rowIndex - 1] = menu;
        }
      });
      return next;
    });
  };

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
            Select menus and quantities for this production request.
          </p>
        </div>

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

              return (
                <div
                  key={field.id}
                  className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_auto]"
                >
                  <MenuPicker
                    id={`production-menu-${field.id}`}
                    label={`Menu ${index + 1}`}
                    value={item?.menu_id ?? ""}
                    selectedMenu={selectedMenus[index] ?? null}
                    onChange={(menu) => handleMenuChange(index, menu)}
                    disabled={isLoading}
                    error={
                      itemErrors?.menu_id?.message ||
                      (isDuplicate ? "This menu is already selected" : undefined)
                    }
                    excludeIds={selectedMenuIds}
                  />

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
                      onClick={() => handleRemoveRow(index)}
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
          disabled={isLoading}
        >
          <Plus className="h-4 w-4" />
          Add line item
        </Button>
      </section>

      <section
        aria-label="Stock estimation"
        className="space-y-4 rounded-xl border border-border bg-muted/20 p-4"
      >
        <div>
          <h4 className="text-base font-semibold">Stock estimation</h4>
          <p className="text-muted-foreground text-sm">
            Estimates update automatically when menus or quantities change.
          </p>
        </div>

        {!hasEstimatableItems(watchedItems) ? (
          <p className="text-muted-foreground text-sm">
            Add menus with valid quantities to preview stock feasibility.
          </p>
        ) : estimateLoading ? (
          <div className="space-y-3" data-testid="production-estimation-loading">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : estimateError ? (
          <p className="text-destructive text-sm" role="alert">
            {estimateError}
          </p>
        ) : estimate ? (
          <div className="space-y-4" data-testid="production-estimation-results">
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                variant={estimate.is_fully_producible ? "success" : "destructive"}
                data-testid="production-estimation-overall-badge"
              >
                {estimate.is_fully_producible
                  ? "Sufficient stock"
                  : "Insufficient stock"}
              </Badge>
            </div>

            <div className="space-y-4">
              {estimate.items.map((line) => (
                <ProductionLineStockEstimation key={line.menu_id} item={line} />
              ))}
            </div>

            {!estimate.is_fully_producible && (
              <ProductionAggregatedIngredientsTable
                ingredients={estimate.aggregated_ingredients.filter(
                  (ingredient) => !ingredient.is_sufficient,
                )}
                title="Aggregated shortages"
                testId="production-estimation-aggregated-shortages"
              />
            )}
          </div>
        ) : null}
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
          disabled={fields.length === 0}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
});

ProductionRequestForm.displayName = "ProductionRequestForm";

"use client";

import * as React from "react";
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import {
  purchaseRequestSchema,
  type PurchaseRequestFormValues,
} from "@/lib/validations";
import { suppliersAdminApi } from "@/lib/api/suppliers";
import { ApiError } from "@/lib/api/client";
import type { Supplier, SupplierPrice } from "@/lib/api/types";
import {
  estimateLineAmount,
  formatRupiah,
  formatSupplierUnitPrice,
} from "@/lib/utils";
import { SupplierPicker } from "@/components/admin/supplier-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

function buildDefaultValues(
  defaultValues?: Partial<PurchaseRequestFormValues>,
): PurchaseRequestFormValues {
  return {
    supplier_id: defaultValues?.supplier_id ?? "",
    items: defaultValues?.items ?? [],
    notes: defaultValues?.notes ?? "",
  };
}

function formatCatalogOptionLabel(price: SupplierPrice) {
  const title = price.food_supply_title ?? "Unknown supply";
  const unitPrice = formatSupplierUnitPrice(
    price.price_amount,
    price.price_quantity,
    price.unit,
  );
  return `${title} · ${unitPrice}`;
}

function findDuplicateItemIndexes(items: PurchaseRequestFormValues["items"]) {
  const seen = new Map<string, number>();
  const duplicates = new Set<number>();

  items.forEach((item, index) => {
    if (!item.food_supply_id) return;
    const firstIndex = seen.get(item.food_supply_id);
    if (firstIndex !== undefined) {
      duplicates.add(firstIndex);
      duplicates.add(index);
    } else {
      seen.set(item.food_supply_id, index);
    }
  });

  return duplicates;
}

export interface PurchaseRequestFormProps {
  defaultValues?: Partial<PurchaseRequestFormValues>;
  onSubmit: (values: PurchaseRequestFormValues) => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel?: string;
}

export interface PurchaseRequestFormHandle {
  applyServerErrors: (fields: Record<string, string>) => void;
  reset: (values?: Partial<PurchaseRequestFormValues>) => void;
}

export const PurchaseRequestForm = React.forwardRef<
  PurchaseRequestFormHandle,
  PurchaseRequestFormProps
>(function PurchaseRequestForm(
  {
    defaultValues,
    onSubmit,
    onCancel,
    isLoading = false,
    submitLabel = "Create purchase request",
  },
  ref,
) {
  const initialValuesRef = useRef(buildDefaultValues(defaultValues));
  const [selectedSupplier, setSelectedSupplier] = useState<
    Pick<Supplier, "id" | "name" | "phone_number"> | null
  >(null);
  const [catalog, setCatalog] = useState<SupplierPrice[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

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
  } = useForm<PurchaseRequestFormValues>({
    resolver: zodResolver(purchaseRequestSchema),
    defaultValues: initialValuesRef.current,
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "items",
  });

  const supplierId = watch("supplier_id");
  const watchedItems = watch("items");

  useEffect(() => {
    const values = buildDefaultValues(defaultValues);
    initialValuesRef.current = values;
    reset(values);
    setSelectedSupplier(null);
    setCatalog([]);
    setCatalogError(null);
  }, [defaultValues, reset]);

  const loadSupplierCatalog = useCallback(async (id: string) => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const result = await suppliersAdminApi.get(id);
      setCatalog(result.data.price_quotes ?? []);
      setSelectedSupplier({
        id: result.data.id,
        name: result.data.name,
        phone_number: result.data.phone_number,
      });
    } catch (err) {
      setCatalog([]);
      setCatalogError(
        err instanceof ApiError
          ? err.message
          : "Failed to load supplier catalog",
      );
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const handleSupplierChange = (supplier: Supplier) => {
    setValue("supplier_id", supplier.id, { shouldValidate: true });
    clearErrors("supplier_id");
    replace([]);
    clearErrors("items");
    setSelectedSupplier({
      id: supplier.id,
      name: supplier.name,
      phone_number: supplier.phone_number,
    });
    void loadSupplierCatalog(supplier.id);
  };

  useImperativeHandle(ref, () => ({
    applyServerErrors(fields: Record<string, string>) {
      for (const [field, message] of Object.entries(fields)) {
        if (field === "supplier_id" || field === "notes") {
          setError(field, { message });
          continue;
        }

        const itemMatch = /^items(?:\[(\d+)\])?\.(.+)$/.exec(field);
        if (itemMatch) {
          const index = Number(itemMatch[1] ?? "0");
          const property = itemMatch[2];
          if (property === "food_supply_id" || property === "quantity") {
            setError(`items.${index}.${property}` as keyof PurchaseRequestFormValues, {
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
    reset(values?: Partial<PurchaseRequestFormValues>) {
      const nextValues = buildDefaultValues({
        ...initialValuesRef.current,
        ...values,
      });
      reset(nextValues);
      setSelectedSupplier(null);
      setCatalog([]);
      setCatalogError(null);
      if (nextValues.supplier_id) {
        void loadSupplierCatalog(nextValues.supplier_id);
      }
    },
  }));

  const catalogBySupplyId = new Map(
    catalog.map((price) => [price.food_supply_id, price]),
  );

  const selectedSupplyIds = watchedItems
    .map((item) => item.food_supply_id)
    .filter((id) => id.length > 0);

  const duplicateIndexes = findDuplicateItemIndexes(watchedItems);

  const lineSummaries = watchedItems.map((item, index) => {
    const price = catalogBySupplyId.get(item.food_supply_id);
    const quantity = item.quantity;
    const estimated =
      price && Number.isFinite(quantity)
        ? estimateLineAmount(price.price_amount, price.price_quantity, quantity)
        : 0;
    return { index, price, quantity, estimated };
  });

  const totalEstimate = lineSummaries.reduce(
    (sum, line) => sum + line.estimated,
    0,
  );

  const canAddItems = Boolean(supplierId) && !catalogLoading && !isLoading;

  const handleAddRow = () => {
    append({ food_supply_id: "", quantity: Number.NaN });
  };

  const handleFormSubmit = (values: PurchaseRequestFormValues) => {
    const duplicates = findDuplicateItemIndexes(values.items);
    if (duplicates.size > 0) {
      duplicates.forEach((index) => {
        setError(`items.${index}.food_supply_id`, {
          message: "This food supply is already selected",
        });
      });
      return;
    }
    void onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6" noValidate>
      <input type="hidden" {...register("supplier_id")} />
      <SupplierPicker
        id="purchase-request-supplier"
        value={supplierId}
        selectedSupplier={selectedSupplier}
        onChange={handleSupplierChange}
        disabled={isLoading}
        error={errors.supplier_id?.message}
      />

      <section aria-label="Line items" className="space-y-4 border-t border-border pt-4">
        <div>
          <h4 className="text-base font-semibold">Line items</h4>
          <p className="text-muted-foreground text-sm">
            Add quantities for food supplies priced by the selected supplier.
          </p>
        </div>

        {!supplierId ? (
          <p className="text-muted-foreground text-sm">
            Select a supplier before adding line items.
          </p>
        ) : catalogLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : catalogError ? (
          <div className="space-y-3">
            <p className="text-destructive text-sm">{catalogError}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => loadSupplierCatalog(supplierId)}
            >
              Retry
            </Button>
          </div>
        ) : catalog.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            This supplier has no catalog prices yet. Add prices on the supplier
            detail page before creating a purchase request.
          </p>
        ) : (
          <>
            {fields.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No line items yet. Add rows to build this purchase request.
              </p>
            ) : (
              <div className="space-y-3">
                {fields.map((field, index) => {
                  const item = watchedItems[index];
                  const price = item
                    ? catalogBySupplyId.get(item.food_supply_id)
                    : undefined;
                  const itemErrors = errors.items?.[index];
                  const isDuplicate = duplicateIndexes.has(index);

                  return (
                    <div
                      key={field.id}
                      className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_auto]"
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor={`purchase-item-${field.id}`}>
                          Item {index + 1}
                        </Label>
                        <select
                          id={`purchase-item-${field.id}`}
                          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 flex h-11 w-full rounded-xl border px-3.5 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                          value={item?.food_supply_id ?? ""}
                          disabled={isLoading}
                          onChange={(event) => {
                            const nextId = event.target.value;
                            setValue(`items.${index}.food_supply_id`, nextId, {
                              shouldValidate: true,
                            });
                            clearErrors(`items.${index}.food_supply_id`);
                          }}
                        >
                          <option value="">Select an item</option>
                          {catalog.map((catalogPrice) => {
                            const isSelectedElsewhere =
                              selectedSupplyIds.includes(catalogPrice.food_supply_id) &&
                              catalogPrice.food_supply_id !== item?.food_supply_id;
                            return (
                              <option
                                key={catalogPrice.id}
                                value={catalogPrice.food_supply_id}
                                disabled={isSelectedElsewhere}
                              >
                                {formatCatalogOptionLabel(catalogPrice)}
                              </option>
                            );
                          })}
                        </select>
                        {(itemErrors?.food_supply_id?.message || isDuplicate) && (
                          <p className="text-destructive text-sm">
                            {itemErrors?.food_supply_id?.message ??
                              "This food supply is already selected"}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor={`purchase-quantity-${field.id}`}>
                          Quantity
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id={`purchase-quantity-${field.id}`}
                            type="number"
                            step="any"
                            min="0"
                            inputMode="decimal"
                            disabled={isLoading}
                            {...register(`items.${index}.quantity`, {
                              valueAsNumber: true,
                            })}
                          />
                          <span className="text-muted-foreground min-w-12 text-sm">
                            {price?.unit ?? "—"}
                          </span>
                        </div>
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
              disabled={!canAddItems || catalog.length === 0}
            >
              <Plus className="h-4 w-4" />
              Add line item
            </Button>
          </>
        )}
      </section>

      <section
        aria-label="Estimated total"
        className="space-y-3 rounded-xl border border-border bg-muted/20 p-4"
      >
        <h4 className="text-base font-semibold">Summary</h4>
        {lineSummaries.length === 0 || !supplierId ? (
          <p className="text-muted-foreground text-sm">
            Add line items to preview the estimated total.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {lineSummaries.map(({ index, price, quantity, estimated }) => {
              if (!price || !itemHasValidQuantity(quantity)) return null;
              const title = price.food_supply_title ?? "Unknown supply";
              return (
                <li
                  key={fields[index]?.id ?? index}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-muted-foreground truncate">
                    {title} · {quantity} {price.unit}
                  </span>
                  <span className="font-medium">{formatRupiah(estimated)}</span>
                </li>
              );
            })}
          </ul>
        )}
        <div className="border-border flex items-center justify-between border-t pt-3">
          <span className="font-semibold">Total estimate</span>
          <span className="text-lg font-semibold">
            {formatRupiah(totalEstimate)}
          </span>
        </div>
      </section>

      <div className="space-y-1.5">
        <Label htmlFor="purchase-request-notes">Notes (optional)</Label>
        <Textarea
          id="purchase-request-notes"
          rows={3}
          disabled={isLoading}
          {...register("notes")}
        />
        {errors.notes && (
          <p className="text-destructive text-sm">{errors.notes.message}</p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          isLoading={isLoading}
          disabled={!supplierId || fields.length === 0}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
});

PurchaseRequestForm.displayName = "PurchaseRequestForm";

function itemHasValidQuantity(quantity: number) {
  return Number.isFinite(quantity) && quantity > 0;
}

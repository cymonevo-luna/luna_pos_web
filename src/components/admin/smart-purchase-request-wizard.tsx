"use client";

import * as React from "react";
import { useCallback, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, ArrowLeft, Plus, Trash2 } from "lucide-react";
import {
  smartPurchaseIngredientsSchema,
  type SmartPurchaseIngredientsFormValues,
} from "@/lib/validations";
import {
  purchaseRequestsAdminApi,
  smartPurchaseIngredientsToPayload,
} from "@/lib/api/purchase-requests";
import { foodSuppliesAdminApi } from "@/lib/api/food-supplies";
import { ApiError } from "@/lib/api/client";
import type { FoodSupply } from "@/lib/api/types";
import {
  allItemsHaveSupplier,
  applySupplierQuoteToItem,
  buildBatchPurchasePayload,
  findSupplierQuote,
  groupWizardItemsBySupplier,
  supplierOptionsForItem,
  wizardItemsFromSuggest,
  type SmartPurchaseWizardItem,
} from "@/lib/api/smart-purchase-utils";
import { FoodSupplyPicker } from "@/components/admin/food-supply-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatRupiah,
  formatSupplierUnitPrice,
} from "@/lib/utils";

type WizardStep = "ingredients" | "review";

function buildDefaultValues(): SmartPurchaseIngredientsFormValues {
  return { items: [] };
}

function findDuplicateItemIndexes(
  items: SmartPurchaseIngredientsFormValues["items"],
) {
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

export interface SmartPurchaseRequestWizardProps {
  onCancel: () => void;
  onSuccess: () => void;
}

export function SmartPurchaseRequestWizard({
  onCancel,
  onSuccess,
}: SmartPurchaseRequestWizardProps) {
  const [step, setStep] = useState<WizardStep>("ingredients");
  const [selectedSupplies, setSelectedSupplies] = useState<
    Record<string, Pick<FoodSupply, "id" | "title" | "unit" | "stock_quantity">>
  >({});
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [wizardItems, setWizardItems] = useState<SmartPurchaseWizardItem[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [manualPricesLoading, setManualPricesLoading] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    setError,
    setValue,
    clearErrors,
    watch,
    formState: { errors },
  } = useForm<SmartPurchaseIngredientsFormValues>({
    resolver: zodResolver(smartPurchaseIngredientsSchema),
    defaultValues: buildDefaultValues(),
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const watchedItems = watch("items");
  const duplicateIndexes = findDuplicateItemIndexes(watchedItems);

  const loadManualPrices = useCallback(async (items: SmartPurchaseWizardItem[]) => {
    const unmatched = items.filter((item) => !item.has_supplier_price);
    if (unmatched.length === 0) return items;

    setManualPricesLoading(true);
    try {
      const updated = await Promise.all(
        items.map(async (item) => {
          if (item.has_supplier_price) return item;
          const result = await foodSuppliesAdminApi.listSupplierPrices(
            item.food_supply_id,
          );
          return {
            ...item,
            manual_supplier_prices: result.data ?? [],
          };
        }),
      );
      return updated;
    } catch (err) {
      setSuggestError(
        err instanceof ApiError
          ? err.message
          : "Failed to load supplier prices for unmatched items",
      );
      return items;
    } finally {
      setManualPricesLoading(false);
    }
  }, []);

  const handleContinue = async (values: SmartPurchaseIngredientsFormValues) => {
    const duplicates = findDuplicateItemIndexes(values.items);
    if (duplicates.size > 0) {
      duplicates.forEach((index) => {
        setError(`items.${index}.food_supply_id`, {
          message: "This food supply is already selected",
        });
      });
      return;
    }

    setSuggestLoading(true);
    setSuggestError(null);
    try {
      const result = await purchaseRequestsAdminApi.suggest(
        smartPurchaseIngredientsToPayload(values),
      );
      let items = wizardItemsFromSuggest(result.data.items);
      items = await loadManualPrices(items);
      setWizardItems(items);
      setStep("review");
    } catch (err) {
      setSuggestError(
        err instanceof ApiError
          ? err.message
          : "Failed to suggest suppliers",
      );
    } finally {
      setSuggestLoading(false);
    }
  };

  const handleSupplierChange = (foodSupplyId: string, supplierId: string) => {
    setWizardItems((current) =>
      current.map((item) => {
        if (item.food_supply_id !== foodSupplyId) return item;
        const quote = findSupplierQuote(supplierId, item);
        if (!quote) return item;
        return applySupplierQuoteToItem(item, quote);
      }),
    );
  };

  const groupedItems = groupWizardItemsBySupplier(wizardItems);
  const canConfirm =
    allItemsHaveSupplier(wizardItems) && !submitting && !manualPricesLoading;
  const totalEstimate = wizardItems.reduce(
    (sum, item) => sum + item.line_estimated_amount,
    0,
  );

  const handleConfirm = async () => {
    if (!canConfirm) return;

    setSubmitting(true);
    setSubmitError(null);
    setFieldErrors({});
    try {
      const payload = buildBatchPurchasePayload(wizardItems, notes);
      await purchaseRequestsAdminApi.batch(payload);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message);
        if (err.fields) {
          setFieldErrors(err.fields);
        }
      } else {
        setSubmitError("Failed to create purchase requests");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToIngredients = () => {
    setStep("ingredients");
    setSuggestError(null);
    setSubmitError(null);
    setFieldErrors({});
  };

  const handleAddRow = () => {
    append({ food_supply_id: "", quantity: Number.NaN });
  };

  const selectedSupplyIds = watchedItems
    .map((item) => item.food_supply_id)
    .filter((id) => id.length > 0);

  return (
    <div className="space-y-6" data-testid="smart-purchase-wizard">
      <nav aria-label="Smart request progress" className="flex gap-2 text-sm">
        <StepIndicator
          step={1}
          label="Ingredients"
          active={step === "ingredients"}
          completed={step === "review"}
        />
        <StepIndicator
          step={2}
          label="Review suppliers"
          active={step === "review"}
          completed={false}
        />
      </nav>

      {step === "ingredients" ? (
        <form
          onSubmit={handleSubmit(handleContinue)}
          className="space-y-6"
          noValidate
          data-testid="smart-purchase-ingredients-step"
        >
          <section aria-label="Ingredients" className="space-y-4">
            <div>
              <h4 className="text-base font-semibold">Ingredients</h4>
              <p className="text-muted-foreground text-sm">
                Add food supplies and quantities. We will suggest the cheapest
                supplier for each item.
              </p>
            </div>

            {fields.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No ingredients yet. Add rows to start a smart request.
              </p>
            ) : (
              <div className="space-y-3">
                {fields.map((field, index) => {
                  const item = watchedItems[index];
                  const itemErrors = errors.items?.[index];
                  const isDuplicate = duplicateIndexes.has(index);
                  const selectedSupply = item?.food_supply_id
                    ? selectedSupplies[item.food_supply_id]
                    : undefined;

                  return (
                    <div
                      key={field.id}
                      className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_auto]"
                    >
                      <FoodSupplyPicker
                        id={`smart-item-${field.id}`}
                        label={`Ingredient ${index + 1}`}
                        value={item?.food_supply_id ?? ""}
                        selectedSupply={selectedSupply}
                        excludeIds={selectedSupplyIds.filter(
                          (id) => id !== item?.food_supply_id,
                        )}
                        disabled={suggestLoading}
                        error={
                          itemErrors?.food_supply_id?.message ??
                          (isDuplicate
                            ? "This food supply is already selected"
                            : undefined)
                        }
                        onChange={(supply) => {
                          setValue(`items.${index}.food_supply_id`, supply.id, {
                            shouldValidate: true,
                          });
                          setSelectedSupplies((current) => ({
                            ...current,
                            [supply.id]: {
                              id: supply.id,
                              title: supply.title,
                              unit: supply.unit,
                              stock_quantity: supply.stock_quantity,
                            },
                          }));
                          clearErrors(`items.${index}.food_supply_id`);
                        }}
                      />

                      <div className="space-y-1.5">
                        <Label htmlFor={`smart-quantity-${field.id}`}>
                          Quantity
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id={`smart-quantity-${field.id}`}
                            type="number"
                            step="any"
                            min="0"
                            inputMode="decimal"
                            disabled={suggestLoading}
                            {...register(`items.${index}.quantity`, {
                              valueAsNumber: true,
                            })}
                          />
                          <span className="text-muted-foreground min-w-12 text-sm">
                            {selectedSupply?.unit ?? "—"}
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
                          aria-label={`Remove ingredient ${index + 1}`}
                          disabled={suggestLoading}
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
              disabled={suggestLoading}
            >
              <Plus className="h-4 w-4" />
              Add ingredient
            </Button>
          </section>

          {suggestError && (
            <p className="text-destructive text-sm" role="alert">
              {suggestError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={suggestLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={suggestLoading}
              disabled={fields.length === 0}
              data-testid="smart-purchase-continue"
            >
              Continue
            </Button>
          </div>
        </form>
      ) : (
        <div
          className="space-y-6"
          data-testid="smart-purchase-review-step"
        >
          <section aria-label="Review suppliers" className="space-y-4">
            <div>
              <h4 className="text-base font-semibold">Review suppliers</h4>
              <p className="text-muted-foreground text-sm">
                Confirm supplier selections and totals before creating purchase
                requests.
              </p>
            </div>

            {manualPricesLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : groupedItems.length === 0 &&
              wizardItems.every((item) => item.selected_supplier_id) ? (
              <p className="text-muted-foreground text-sm">
                No supplier groups to review.
              </p>
            ) : (
              <div className="space-y-4">
                {groupedItems.map((group) => (
                  <div
                    key={group.supplier_id}
                    className="space-y-3 rounded-xl border border-border p-4"
                    data-testid={`supplier-group-${group.supplier_id}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h5 className="font-semibold">{group.supplier_name}</h5>
                      <span className="text-sm font-medium">
                        {formatRupiah(group.group_total_estimated_amount ?? 0)}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {group.items.map((item) => (
                        <ReviewItemRow
                          key={item.food_supply_id}
                          item={item}
                          onSupplierChange={handleSupplierChange}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {wizardItems
                  .filter((item) => !item.selected_supplier_id)
                  .map((item) => (
                    <div
                      key={item.food_supply_id}
                      className="space-y-3 rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/20"
                    >
                      <ReviewItemRow
                        item={item}
                        onSupplierChange={handleSupplierChange}
                      />
                    </div>
                  ))}
              </div>
            )}
          </section>

          <div className="space-y-1.5">
            <Label htmlFor="smart-purchase-notes">Notes (optional)</Label>
            <Textarea
              id="smart-purchase-notes"
              rows={3}
              disabled={submitting}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
            {fieldErrors.notes && (
              <p className="text-destructive text-sm">{fieldErrors.notes}</p>
            )}
          </div>

          <section
            aria-label="Total estimate"
            className="rounded-xl border border-border bg-muted/20 p-4"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">Total estimate</span>
              <span className="text-lg font-semibold">
                {formatRupiah(totalEstimate)}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              {groupedItems.length} supplier
              {groupedItems.length === 1 ? "" : "s"} · {wizardItems.length}{" "}
              item{wizardItems.length === 1 ? "" : "s"}
            </p>
          </section>

          {submitError && (
            <p className="text-destructive text-sm" role="alert">
              {submitError}
            </p>
          )}

          {Object.keys(fieldErrors).length > 0 && !fieldErrors.notes && (
            <div className="text-destructive space-y-1 text-sm" role="alert">
              {Object.entries(fieldErrors).map(([field, message]) => (
                <p key={field}>
                  {field}: {message}
                </p>
              ))}
            </div>
          )}

          <div className="flex justify-between gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleBackToIngredients}
              disabled={submitting}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                isLoading={submitting}
                disabled={!canConfirm}
                onClick={() => void handleConfirm()}
                data-testid="smart-purchase-confirm"
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StepIndicator({
  step,
  label,
  active,
  completed,
}: {
  step: number;
  label: string;
  active: boolean;
  completed: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-full px-3 py-1 ${
        active
          ? "bg-primary text-primary-foreground"
          : completed
            ? "bg-muted text-foreground"
            : "bg-muted/50 text-muted-foreground"
      }`}
    >
      <span className="font-medium">{step}.</span>
      <span>{label}</span>
    </div>
  );
}

function ReviewItemRow({
  item,
  onSupplierChange,
}: {
  item: SmartPurchaseWizardItem;
  onSupplierChange: (foodSupplyId: string, supplierId: string) => void;
}) {
  const options = supplierOptionsForItem(item);
  const needsSupplier = !item.selected_supplier_id;

  return (
    <div
      className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]"
      data-testid={`review-item-${item.food_supply_id}`}
    >
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{item.food_supply_title}</span>
          {!item.has_supplier_price && (
            <Badge variant="warning" data-testid="unmatched-supplier-badge">
              <AlertTriangle className="mr-1 h-3 w-3" />
              No supplier price
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          {item.quantity} {item.unit}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`supplier-${item.food_supply_id}`}>Supplier</Label>
        <select
          id={`supplier-${item.food_supply_id}`}
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 flex h-11 w-full rounded-xl border px-3.5 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          value={item.selected_supplier_id ?? ""}
          onChange={(event) =>
            onSupplierChange(item.food_supply_id, event.target.value)
          }
          data-testid={`supplier-select-${item.food_supply_id}`}
        >
          <option value="">Select supplier</option>
          {options.map((quote) => (
            <option key={quote.supplier_id} value={quote.supplier_id}>
              {quote.supplier_name} ·{" "}
              {formatSupplierUnitPrice(
                quote.price_amount,
                quote.price_quantity,
                item.unit,
              )}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1 text-right sm:pt-7">
        <p className="text-muted-foreground text-sm">
          {item.selected_supplier_id
            ? formatSupplierUnitPrice(
                item.price_amount,
                item.price_quantity,
                item.unit,
              )
            : "—"}
        </p>
        <p
          className="font-medium"
          data-testid={`line-total-${item.food_supply_id}`}
        >
          {needsSupplier ? "—" : formatRupiah(item.line_estimated_amount)}
        </p>
      </div>
    </div>
  );
}

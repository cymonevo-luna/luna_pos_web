"use client";

import * as React from "react";
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useFieldArray, useForm, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import {
  supplierSchema,
  type SupplierFormValues,
} from "@/lib/validations";
import { foodSuppliesAdminApi } from "@/lib/api/food-supplies";
import { ApiError } from "@/lib/api/client";
import type { FoodSupply, FoodSupplyUnit } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const UNIT_LABELS: Record<FoodSupplyUnit, string> = {
  ml: "Millilitre",
  piece: "Piece",
  gr: "Gram",
};

const DUPLICATE_FOOD_SUPPLY_MESSAGE = "This food supply is already selected";

function formatFoodSupplyOptionLabel(supply: FoodSupply) {
  return `${supply.title} (${supply.unit})`;
}

function buildDefaultValues(
  defaultValues?: Partial<SupplierFormValues>,
): SupplierFormValues {
  return {
    name: defaultValues?.name ?? "",
    phone_number: defaultValues?.phone_number ?? "",
    address: defaultValues?.address ?? "",
    supports_delivery: defaultValues?.supports_delivery ?? false,
    delivery_cost: defaultValues?.delivery_cost,
    food_items: defaultValues?.food_items ?? [],
  };
}

function createBlankFoodItem(): SupplierFormValues["food_items"][number] {
  return {
    food_supply_id: "",
    price: Number.NaN,
    quantity: Number.NaN,
    unit: "" as SupplierFormValues["food_items"][number]["unit"],
  };
}

function blockDecimalInput(event: React.KeyboardEvent<HTMLInputElement>) {
  if (event.key === "." || event.key === "," || event.key === "e" || event.key === "E") {
    event.preventDefault();
  }
}

function mapServerFieldPath(field: string): Path<SupplierFormValues> | null {
  const foodItemMatch = /^food_items\[(\d+)\]\.(.+)$/.exec(field);
  if (foodItemMatch) {
    const index = foodItemMatch[1];
    const property = foodItemMatch[2];
    if (
      property === "food_supply_id" ||
      property === "price" ||
      property === "quantity" ||
      property === "unit"
    ) {
      return `food_items.${index}.${property}` as Path<SupplierFormValues>;
    }
    return null;
  }

  if (
    field === "name" ||
    field === "phone_number" ||
    field === "address" ||
    field === "supports_delivery" ||
    field === "delivery_cost"
  ) {
    return field;
  }

  return null;
}

export interface SupplierFormProps {
  defaultValues?: Partial<SupplierFormValues>;
  onSubmit: (values: SupplierFormValues) => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel?: string;
}

export interface SupplierFormHandle {
  applyServerErrors: (fields: Record<string, string>) => void;
  reset: (values?: Partial<SupplierFormValues>) => void;
}

export const SupplierForm = React.forwardRef<SupplierFormHandle, SupplierFormProps>(
  function SupplierForm(
    {
      defaultValues,
      onSubmit,
      onCancel,
      isLoading = false,
      submitLabel = "Save",
    },
    ref,
  ) {
    const initialValuesRef = useRef(buildDefaultValues(defaultValues));
    const [foodSupplies, setFoodSupplies] = useState<FoodSupply[]>([]);
    const [foodSuppliesError, setFoodSuppliesError] = useState<string | null>(null);
    const [loadingFoodSupplies, setLoadingFoodSupplies] = useState(true);

    const {
      register,
      control,
      handleSubmit,
      reset,
      setError,
      setValue,
      watch,
      clearErrors,
      formState: { errors },
    } = useForm<SupplierFormValues>({
      resolver: zodResolver(supplierSchema),
      defaultValues: initialValuesRef.current,
    });

    const { fields, append, remove } = useFieldArray({
      control,
      name: "food_items",
    });

    const supportsDelivery = watch("supports_delivery");
    const foodItems = watch("food_items");

    const loadFoodSupplies = useCallback(async () => {
      setLoadingFoodSupplies(true);
      setFoodSuppliesError(null);
      try {
        const result = await foodSuppliesAdminApi.list({ page: 1, perPage: 100 });
        setFoodSupplies(result.data ?? []);
      } catch (err) {
        setFoodSupplies([]);
        setFoodSuppliesError(
          err instanceof ApiError
            ? err.message
            : "Failed to load food supplies",
        );
      } finally {
        setLoadingFoodSupplies(false);
      }
    }, []);

    useEffect(() => {
      void loadFoodSupplies();
    }, [loadFoodSupplies]);

    useEffect(() => {
      const values = buildDefaultValues(defaultValues);
      initialValuesRef.current = values;
      reset(values);
    }, [defaultValues, reset]);

    useEffect(() => {
      if (!supportsDelivery) {
        setValue("delivery_cost", undefined);
        clearErrors("delivery_cost");
      }
    }, [supportsDelivery, setValue, clearErrors]);

    useImperativeHandle(ref, () => ({
      applyServerErrors(fields: Record<string, string>) {
        for (const [field, message] of Object.entries(fields)) {
          const path = mapServerFieldPath(field);
          if (path) {
            setError(path, { message });
          }
        }
      },
      reset(values?: Partial<SupplierFormValues>) {
        reset(buildDefaultValues({ ...initialValuesRef.current, ...values }));
      },
    }));

    const selectedFoodSupplyIds = foodItems
      .map((item) => item.food_supply_id)
      .filter((id) => id.length > 0);

    const validateDuplicateFoodSupplies = (values: SupplierFormValues) => {
      const seen = new Map<string, number>();
      let hasDuplicate = false;

      values.food_items.forEach((item, index) => {
        if (!item.food_supply_id) return;
        const firstIndex = seen.get(item.food_supply_id);
        if (firstIndex !== undefined) {
          setError(`food_items.${index}.food_supply_id`, {
            message: DUPLICATE_FOOD_SUPPLY_MESSAGE,
          });
          setError(`food_items.${firstIndex}.food_supply_id`, {
            message: DUPLICATE_FOOD_SUPPLY_MESSAGE,
          });
          hasDuplicate = true;
        } else {
          seen.set(item.food_supply_id, index);
        }
      });

      return !hasDuplicate;
    };

    const handleFormSubmit = handleSubmit((values) => {
      if (!validateDuplicateFoodSupplies(values)) {
        return;
      }
      onSubmit(values);
    });

    const handleFoodSupplyChange = (
      index: number,
      event: React.ChangeEvent<HTMLSelectElement>,
    ) => {
      const supplyId = event.target.value;
      const supply = foodSupplies.find((item) => item.id === supplyId);
      setValue(`food_items.${index}.food_supply_id`, supplyId, {
        shouldValidate: true,
      });
      if (supply) {
        setValue(`food_items.${index}.unit`, supply.unit, {
          shouldValidate: true,
        });
      }
      clearErrors(`food_items.${index}.food_supply_id`);
    };

    const foodItemAddDisabled =
      isLoading || loadingFoodSupplies || foodSuppliesError !== null;

    return (
      <form onSubmit={handleFormSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="supplier-name">Name</Label>
          <Input
            id="supplier-name"
            autoComplete="off"
            {...register("name")}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="supplier-phone">Phone number</Label>
          <Input
            id="supplier-phone"
            type="tel"
            autoComplete="off"
            {...register("phone_number")}
          />
          {errors.phone_number && (
            <p className="text-sm text-destructive">
              {errors.phone_number.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="supplier-address">Address</Label>
          <Textarea id="supplier-address" rows={3} {...register("address")} />
          {errors.address && (
            <p className="text-sm text-destructive">{errors.address.message}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            id="supplier-supports-delivery"
            type="checkbox"
            className="border-input h-4 w-4 rounded border"
            {...register("supports_delivery")}
          />
          <Label htmlFor="supplier-supports-delivery">Supports delivery</Label>
        </div>
        {errors.supports_delivery && (
          <p className="text-sm text-destructive">
            {errors.supports_delivery.message}
          </p>
        )}

        {supportsDelivery && (
          <div className="space-y-1.5">
            <Label htmlFor="supplier-delivery-cost">Delivery cost (Rp)</Label>
            <Input
              id="supplier-delivery-cost"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              onKeyDown={blockDecimalInput}
              {...register("delivery_cost", {
                setValueAs: (value) => {
                  if (value === "" || value === null || value === undefined) {
                    return undefined;
                  }
                  const parsed = Number(value);
                  return Number.isFinite(parsed) ? parsed : Number.NaN;
                },
              })}
            />
            {errors.delivery_cost && (
              <p className="text-sm text-destructive">
                {errors.delivery_cost.message}
              </p>
            )}
          </div>
        )}

        <div className="space-y-3 border-t border-border pt-4">
          <div>
            <h4 className="text-base font-semibold">Food items</h4>
            <p className="text-muted-foreground text-sm">
              Add food supplies this supplier can provide, with price and quantity.
            </p>
          </div>

          {foodSuppliesError && (
            <p className="text-destructive text-sm">{foodSuppliesError}</p>
          )}

          {fields.length > 0 && (
            <div className="space-y-3">
              {fields.map((field, index) => {
                const currentSupplyId = foodItems[index]?.food_supply_id ?? "";
                const unit = foodItems[index]?.unit;
                const availableOptions = foodSupplies
                  .filter(
                    (supply) =>
                      supply.id === currentSupplyId ||
                      !selectedFoodSupplyIds.includes(supply.id),
                  )
                  .map((supply) => ({
                    value: supply.id,
                    label: formatFoodSupplyOptionLabel(supply),
                  }));

                return (
                  <div
                    key={field.id}
                    className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_auto]"
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor={`supplier-food-item-${index}-supply`}>
                        Food supply
                      </Label>
                      <Select
                        id={`supplier-food-item-${index}-supply`}
                        options={availableOptions}
                        placeholder={
                          loadingFoodSupplies ? "Loading…" : "Select a food supply"
                        }
                        disabled={isLoading || loadingFoodSupplies}
                        {...register(`food_items.${index}.food_supply_id`, {
                          onChange: (event) => handleFoodSupplyChange(index, event),
                        })}
                      />
                      {errors.food_items?.[index]?.food_supply_id && (
                        <p className="text-sm text-destructive">
                          {errors.food_items[index]?.food_supply_id?.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`supplier-food-item-${index}-price`}>
                        Price (Rp)
                      </Label>
                      <Input
                        id={`supplier-food-item-${index}-price`}
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        onKeyDown={blockDecimalInput}
                        disabled={isLoading}
                        {...register(`food_items.${index}.price`, {
                          valueAsNumber: true,
                        })}
                      />
                      {errors.food_items?.[index]?.price && (
                        <p className="text-sm text-destructive">
                          {errors.food_items[index]?.price?.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`supplier-food-item-${index}-quantity`}>
                        Quantity
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id={`supplier-food-item-${index}-quantity`}
                          type="number"
                          step="any"
                          min="0"
                          inputMode="decimal"
                          disabled={isLoading}
                          {...register(`food_items.${index}.quantity`, {
                            valueAsNumber: true,
                          })}
                        />
                        <span className="text-muted-foreground min-w-16 text-sm">
                          {unit ? UNIT_LABELS[unit] ?? unit : "—"}
                        </span>
                      </div>
                      {errors.food_items?.[index]?.quantity && (
                        <p className="text-sm text-destructive">
                          {errors.food_items[index]?.quantity?.message}
                        </p>
                      )}
                    </div>

                    <div className="flex items-end justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive h-11 w-11"
                        aria-label={`Remove food item ${index + 1}`}
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

          <Button
            type="button"
            variant="outline"
            disabled={foodItemAddDisabled}
            onClick={() => append(createBlankFoodItem())}
          >
            <Plus className="h-4 w-4" />
            Add food item
          </Button>
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
          <Button type="submit" isLoading={isLoading}>
            {submitLabel}
          </Button>
        </div>
      </form>
    );
  },
);

SupplierForm.displayName = "SupplierForm";

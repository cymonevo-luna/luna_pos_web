"use client";

import * as React from "react";
import { useEffect, useImperativeHandle, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  supplierPriceSchema,
  type SupplierPriceFormValues,
} from "@/lib/validations";
import type { FoodSupply } from "@/lib/api/types";
import { getUnitLabel } from "@/lib/units";
import { formatSupplierUnitPrice } from "@/lib/utils";
import { FoodSupplyPicker } from "@/components/admin/food-supply-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function buildDefaultValues(
  defaultValues?: Partial<SupplierPriceFormValues>,
): SupplierPriceFormValues {
  return {
    food_supply_id: defaultValues?.food_supply_id ?? "",
    price_amount: defaultValues?.price_amount ?? Number.NaN,
    price_quantity: defaultValues?.price_quantity ?? Number.NaN,
  };
}

function blockDecimalInput(event: React.KeyboardEvent<HTMLInputElement>) {
  if (event.key === "." || event.key === "," || event.key === "e" || event.key === "E") {
    event.preventDefault();
  }
}

export interface SupplierPriceFormProps {
  defaultValues?: Partial<SupplierPriceFormValues>;
  selectedSupply?: Pick<FoodSupply, "id" | "title" | "unit" | "stock_quantity"> | null;
  onSubmit: (values: SupplierPriceFormValues) => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel?: string;
}

export interface SupplierPriceFormHandle {
  applyServerErrors: (fields: Record<string, string>) => void;
  reset: (values?: Partial<SupplierPriceFormValues>) => void;
}

export const SupplierPriceForm = React.forwardRef<
  SupplierPriceFormHandle,
  SupplierPriceFormProps
>(function SupplierPriceForm(
  {
    defaultValues,
    selectedSupply: initialSelectedSupply,
    onSubmit,
    onCancel,
    isLoading = false,
    submitLabel = "Save price",
  },
  ref,
) {
  const initialValuesRef = useRef(buildDefaultValues(defaultValues));
  const [selectedSupply, setSelectedSupply] = React.useState<
  Pick<FoodSupply, "id" | "title" | "unit" | "stock_quantity"> | null
  >(initialSelectedSupply ?? null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SupplierPriceFormValues>({
    resolver: zodResolver(supplierPriceSchema),
    defaultValues: initialValuesRef.current,
  });

  const priceAmount = watch("price_amount");
  const priceQuantity = watch("price_quantity");
  const foodSupplyId = watch("food_supply_id");

  useEffect(() => {
    const values = buildDefaultValues(defaultValues);
    initialValuesRef.current = values;
    reset(values);
    setSelectedSupply(initialSelectedSupply ?? null);
  }, [defaultValues, initialSelectedSupply, reset]);

  useImperativeHandle(ref, () => ({
    applyServerErrors(fields: Record<string, string>) {
      for (const [field, message] of Object.entries(fields)) {
        if (
          field === "food_supply_id" ||
          field === "price_amount" ||
          field === "price_quantity"
        ) {
          setError(field, { message });
        }
      }
    },
    reset(values?: Partial<SupplierPriceFormValues>) {
      reset(buildDefaultValues({ ...initialValuesRef.current, ...values }));
    },
  }));

  const unitLabel = selectedSupply
    ? getUnitLabel(selectedSupply.unit)
    : "—";

  const unitPricePreview =
    selectedSupply &&
    Number.isFinite(priceAmount) &&
    Number.isFinite(priceQuantity)
      ? formatSupplierUnitPrice(
          priceAmount,
          priceQuantity,
          selectedSupply.unit,
        )
      : null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <input type="hidden" {...register("food_supply_id")} />
      <FoodSupplyPicker
        id="supplier-price-food-supply"
        value={foodSupplyId}
        selectedSupply={selectedSupply}
        onChange={(supply) => {
          setSelectedSupply(supply);
          setValue("food_supply_id", supply.id, { shouldValidate: true });
        }}
        disabled={isLoading}
        error={errors.food_supply_id?.message}
      />

      <div className="space-y-1.5">
        <Label htmlFor="supplier-price-unit">Unit</Label>
        <Input
          id="supplier-price-unit"
          value={unitLabel}
          readOnly
          disabled
          className="bg-muted/40"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="supplier-price-amount">Price amount (Rp)</Label>
        <Input
          id="supplier-price-amount"
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          onKeyDown={blockDecimalInput}
          disabled={isLoading}
          {...register("price_amount", { valueAsNumber: true })}
        />
        {errors.price_amount && (
          <p className="text-sm text-destructive">
            {errors.price_amount.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="supplier-price-quantity">Price quantity</Label>
        <Input
          id="supplier-price-quantity"
          type="number"
          step="any"
          min="0"
          inputMode="decimal"
          disabled={isLoading}
          {...register("price_quantity", { valueAsNumber: true })}
        />
        {errors.price_quantity && (
          <p className="text-sm text-destructive">
            {errors.price_quantity.message}
          </p>
        )}
      </div>

      {unitPricePreview && (
        <p className="text-muted-foreground text-sm">
          Unit price preview:{" "}
          <span className="text-foreground font-medium">{unitPricePreview}</span>
        </p>
      )}

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
});

SupplierPriceForm.displayName = "SupplierPriceForm";

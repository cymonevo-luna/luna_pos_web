"use client";

import * as React from "react";
import { useEffect, useImperativeHandle, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  foodSupplySchema,
  type FoodSupplyFormValues,
} from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const UNIT_OPTIONS = [
  { value: "ml", label: "Millilitre" },
  { value: "piece", label: "Piece" },
  { value: "gr", label: "Gram" },
] as const;

function buildDefaultValues(
  defaultValues?: Partial<FoodSupplyFormValues>,
): FoodSupplyFormValues {
  return {
    title: defaultValues?.title ?? "",
    description: defaultValues?.description ?? "",
    stock_quantity: defaultValues?.stock_quantity ?? Number.NaN,
    unit: defaultValues?.unit ?? ("" as FoodSupplyFormValues["unit"]),
  };
}

export interface FoodSupplyFormProps {
  defaultValues?: Partial<FoodSupplyFormValues>;
  onSubmit: (values: FoodSupplyFormValues) => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel?: string;
}

export interface FoodSupplyFormHandle {
  applyServerErrors: (fields: Record<string, string>) => void;
  reset: (values?: Partial<FoodSupplyFormValues>) => void;
}

export const FoodSupplyForm = React.forwardRef<
  FoodSupplyFormHandle,
  FoodSupplyFormProps
>(function FoodSupplyForm(
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

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FoodSupplyFormValues>({
    resolver: zodResolver(foodSupplySchema),
    defaultValues: initialValuesRef.current,
  });

  useEffect(() => {
    const values = buildDefaultValues(defaultValues);
    initialValuesRef.current = values;
    reset(values);
  }, [defaultValues, reset]);

  useImperativeHandle(ref, () => ({
    applyServerErrors(fields: Record<string, string>) {
      for (const [field, message] of Object.entries(fields)) {
        if (
          field === "title" ||
          field === "description" ||
          field === "stock_quantity" ||
          field === "unit"
        ) {
          setError(field, { message });
        }
      }
    },
    reset(values?: Partial<FoodSupplyFormValues>) {
      reset(buildDefaultValues({ ...initialValuesRef.current, ...values }));
    },
  }));

  const isEditing = defaultValues?.unit !== undefined;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="food-supply-title">Title</Label>
        <Input
          id="food-supply-title"
          autoComplete="off"
          {...register("title")}
        />
        {errors.title && (
          <p className="text-sm text-destructive">{errors.title.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="food-supply-description">
          Description{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="food-supply-description"
          rows={3}
          {...register("description")}
        />
        {errors.description && (
          <p className="text-sm text-destructive">
            {errors.description.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="food-supply-stock">Stock quantity</Label>
        <Input
          id="food-supply-stock"
          type="number"
          step="any"
          inputMode="decimal"
          {...register("stock_quantity", { valueAsNumber: true })}
        />
        {errors.stock_quantity && (
          <p className="text-sm text-destructive">
            {errors.stock_quantity.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="food-supply-unit">Unit</Label>
        <Select
          id="food-supply-unit"
          options={[...UNIT_OPTIONS]}
          placeholder={isEditing ? undefined : "Select a unit"}
          {...register("unit")}
        />
        <p className="text-xs text-muted-foreground">
          Use millilitres (ml) for liquids, grams (gr) for dry ingredients, and
          piece for countable items such as eggs or bottles.
        </p>
        {errors.unit && (
          <p className="text-sm text-destructive">{errors.unit.message}</p>
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
        <Button type="submit" isLoading={isLoading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
});

FoodSupplyForm.displayName = "FoodSupplyForm";

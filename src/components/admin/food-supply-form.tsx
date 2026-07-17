"use client";

import * as React from "react";
import { useEffect, useImperativeHandle, useRef } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import {
  foodSupplySchema,
  type FoodSupplyFormValues,
} from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { UNIT_OPTIONS, getUnitLabel } from "@/lib/units";

function buildDefaultValues(
  defaultValues?: Partial<FoodSupplyFormValues>,
): FoodSupplyFormValues {
  return {
    title: defaultValues?.title ?? "",
    description: defaultValues?.description ?? "",
    stock_quantity: defaultValues?.stock_quantity ?? Number.NaN,
    unit: defaultValues?.unit ?? ("" as FoodSupplyFormValues["unit"]),
    cooking_measurements: defaultValues?.cooking_measurements ?? [],
  };
}

function formatConversionHelperText(
  name: string,
  conversion: string,
  unit: FoodSupplyFormValues["unit"],
) {
  const unitLabel = unit ? getUnitLabel(unit) : "base unit";
  const trimmedName = name.trim() || "unit";
  const trimmedConversion = conversion.trim() || "…";
  return `1 ${trimmedName} equals ${trimmedConversion} ${unitLabel}`;
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
    control,
    formState: { errors },
  } = useForm<FoodSupplyFormValues>({
    resolver: zodResolver(foodSupplySchema),
    defaultValues: initialValuesRef.current,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "cooking_measurements",
  });

  const selectedUnit = useWatch({ control, name: "unit" });
  const watchedMeasurements = useWatch({
    control,
    name: "cooking_measurements",
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
          field === "unit" ||
          field === "cooking_measurements"
        ) {
          setError(field, { message });
          continue;
        }

        const measurementMatch =
          /^cooking_measurements(?:\[(\d+)\])?\.(.+)$/.exec(field);
        if (measurementMatch) {
          const index = Number(measurementMatch[1] ?? "0");
          const property = measurementMatch[2];
          if (property === "name" || property === "conversion_quantity") {
            setError(
              `cooking_measurements.${index}.${property}` as keyof FoodSupplyFormValues,
              { message },
            );
          }
        }
      }
    },
    reset(values?: Partial<FoodSupplyFormValues>) {
      reset(buildDefaultValues({ ...initialValuesRef.current, ...values }));
    },
  }));

  const isEditing = defaultValues?.unit !== undefined;

  const handleAddMeasurement = () => {
    append({ name: "", conversion_quantity: "" });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
          Use ml for liquids, gr for dry ingredients, and pcs for countable
          items such as eggs or bottles.
        </p>
        {errors.unit && (
          <p className="text-sm text-destructive">{errors.unit.message}</p>
        )}
      </div>

      <section
        aria-label="Cooking measurements"
        className="space-y-3 border-t border-border pt-4"
      >
        <div>
          <h4 className="text-base font-semibold">Cooking measurements</h4>
          <p className="text-sm text-muted-foreground">
            Optional alternate units for recipes, such as tablespoons or
            teaspoons.
          </p>
        </div>

        {errors.cooking_measurements?.message ? (
          <p className="text-sm text-destructive">
            {errors.cooking_measurements.message}
          </p>
        ) : null}

        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No cooking measurements yet.
          </p>
        ) : (
          <div className="space-y-4">
            {fields.map((field, index) => {
              const measurement = watchedMeasurements?.[index];
              const nameError = errors.cooking_measurements?.[index]?.name;
              const conversionError =
                errors.cooking_measurements?.[index]?.conversion_quantity;

              return (
                <div
                  key={field.id}
                  className="space-y-3 rounded-lg border border-border p-3"
                >
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <div className="space-y-1.5">
                      <Label htmlFor={`cooking-measurement-name-${index}`}>
                        Name
                      </Label>
                      <Input
                        id={`cooking-measurement-name-${index}`}
                        placeholder="Tablespoon"
                        autoComplete="off"
                        {...register(`cooking_measurements.${index}.name`)}
                      />
                      {nameError ? (
                        <p className="text-sm text-destructive">
                          {nameError.message}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`cooking-measurement-conversion-${index}`}>
                        Conversion
                      </Label>
                      <Input
                        id={`cooking-measurement-conversion-${index}`}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        {...register(
                          `cooking_measurements.${index}.conversion_quantity`,
                        )}
                      />
                      {conversionError ? (
                        <p className="text-sm text-destructive">
                          {conversionError.message}
                        </p>
                      ) : null}
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 shrink-0 text-destructive"
                      aria-label="Remove cooking measurement"
                      onClick={() => remove(index)}
                      disabled={isLoading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {formatConversionHelperText(
                      measurement?.name ?? "",
                      measurement?.conversion_quantity ?? "",
                      selectedUnit,
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddMeasurement}
          disabled={isLoading}
        >
          <Plus className="h-4 w-4" />
          Add measurement
        </Button>
      </section>

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

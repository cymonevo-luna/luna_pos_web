"use client";

import * as React from "react";
import { useEffect, useImperativeHandle, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  orderOptionSchema,
  type OrderOptionFormValues,
} from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function blockDecimalInput(event: React.KeyboardEvent<HTMLInputElement>) {
  if (event.key === "." || event.key === "," || event.key === "e" || event.key === "E") {
    event.preventDefault();
  }
}

function buildDefaultValues(
  defaultValues?: Partial<OrderOptionFormValues>,
): OrderOptionFormValues {
  return {
    name: defaultValues?.name ?? "",
    additional_price: defaultValues?.additional_price ?? 0,
  };
}

export interface OrderOptionFormProps {
  defaultValues?: Partial<OrderOptionFormValues>;
  onSubmit: (values: OrderOptionFormValues) => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel?: string;
}

export interface OrderOptionFormHandle {
  applyServerErrors: (fields: Record<string, string>) => void;
  reset: (values?: Partial<OrderOptionFormValues>) => void;
}

export const OrderOptionForm = React.forwardRef<
  OrderOptionFormHandle,
  OrderOptionFormProps
>(function OrderOptionForm(
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
  } = useForm<OrderOptionFormValues>({
    resolver: zodResolver(orderOptionSchema),
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
        if (field === "name" || field === "additional_price") {
          setError(field, { message });
        }
      }
    },
    reset(values?: Partial<OrderOptionFormValues>) {
      reset(buildDefaultValues({ ...initialValuesRef.current, ...values }));
    },
  }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="order-option-name">Name</Label>
        <Input
          id="order-option-name"
          autoComplete="off"
          maxLength={100}
          {...register("name")}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="order-option-additional-price">
          Additional Price (IDR)
        </Label>
        <Input
          id="order-option-additional-price"
          type="number"
          inputMode="numeric"
          step={1}
          autoComplete="off"
          onKeyDown={blockDecimalInput}
          {...register("additional_price", { valueAsNumber: true })}
        />
        <p className="text-sm text-muted-foreground">
          Optional; leave 0 for no surcharge
        </p>
        {errors.additional_price && (
          <p className="text-sm text-destructive">
            {errors.additional_price.message}
          </p>
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

OrderOptionForm.displayName = "OrderOptionForm";

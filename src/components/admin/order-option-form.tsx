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

function buildDefaultValues(
  defaultValues?: Partial<OrderOptionFormValues>,
): OrderOptionFormValues {
  return {
    name: defaultValues?.name ?? "",
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
        if (field === "name") {
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

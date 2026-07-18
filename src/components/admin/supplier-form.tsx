"use client";

import * as React from "react";
import { useEffect, useImperativeHandle, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  supplierSchema,
  type SupplierFormValues,
} from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function buildDefaultValues(
  defaultValues?: Partial<SupplierFormValues>,
): SupplierFormValues {
  return {
    name: defaultValues?.name ?? "",
    phone_number: defaultValues?.phone_number ?? "",
    address: defaultValues?.address ?? "",
    supports_delivery: defaultValues?.supports_delivery ?? false,
    delivery_cost: defaultValues?.delivery_cost,
  };
}

function blockDecimalInput(event: React.KeyboardEvent<HTMLInputElement>) {
  if (event.key === "." || event.key === "," || event.key === "e" || event.key === "E") {
    event.preventDefault();
  }
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

    const {
      register,
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

    const supportsDelivery = watch("supports_delivery");

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
          if (
            field === "name" ||
            field === "phone_number" ||
            field === "address" ||
            field === "supports_delivery" ||
            field === "delivery_cost"
          ) {
            setError(field, { message });
          }
        }
      },
      reset(values?: Partial<SupplierFormValues>) {
        reset(buildDefaultValues({ ...initialValuesRef.current, ...values }));
      },
    }));

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
          <Label htmlFor="supplier-phone">
            Phone number{" "}
            <span className="font-normal text-muted-foreground">
              (recommended)
            </span>
          </Label>
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

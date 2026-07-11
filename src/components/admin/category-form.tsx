"use client";

import * as React from "react";
import { useEffect, useImperativeHandle, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { categorySchema, type CategoryFormValues } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function buildDefaultValues(
  defaultValues?: Partial<CategoryFormValues>,
): CategoryFormValues {
  return {
    name: defaultValues?.name ?? "",
  };
}

export interface CategoryFormProps {
  defaultValues?: Partial<CategoryFormValues>;
  onSubmit: (values: CategoryFormValues) => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel?: string;
}

export interface CategoryFormHandle {
  applyServerErrors: (fields: Record<string, string>) => void;
  reset: (values?: Partial<CategoryFormValues>) => void;
}

export const CategoryForm = React.forwardRef<
  CategoryFormHandle,
  CategoryFormProps
>(function CategoryForm(
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
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
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
    reset(values?: Partial<CategoryFormValues>) {
      reset(buildDefaultValues({ ...initialValuesRef.current, ...values }));
    },
  }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="category-name">Name</Label>
        <Input
          id="category-name"
          autoComplete="off"
          maxLength={120}
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

CategoryForm.displayName = "CategoryForm";

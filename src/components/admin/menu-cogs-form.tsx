"use client";

import * as React from "react";
import { useEffect, useImperativeHandle, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { menuCogsSchema, type MenuCogsFormValues } from "@/lib/validations";
import { MENU_COGS_DEFAULTS } from "@/lib/menu-cogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function buildDefaultValues(
  defaultValues?: Partial<MenuCogsFormValues>,
): MenuCogsFormValues {
  return {
    recipe_yield: defaultValues?.recipe_yield ?? MENU_COGS_DEFAULTS.recipe_yield,
    margin_percent:
      defaultValues?.margin_percent ?? MENU_COGS_DEFAULTS.margin_percent,
    vat_percent: defaultValues?.vat_percent ?? MENU_COGS_DEFAULTS.vat_percent,
  };
}

function blockDecimalInput(event: React.KeyboardEvent<HTMLInputElement>) {
  if (event.key === "." || event.key === "," || event.key === "e" || event.key === "E") {
    event.preventDefault();
  }
}

export interface MenuCogsFormProps {
  defaultValues?: Partial<MenuCogsFormValues>;
  onSubmit: (values: MenuCogsFormValues) => void | Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

export interface MenuCogsFormHandle {
  applyServerErrors: (fields: Record<string, string>) => void;
  reset: (values?: Partial<MenuCogsFormValues>) => void;
}

export const MenuCogsForm = React.forwardRef<
  MenuCogsFormHandle,
  MenuCogsFormProps
>(function MenuCogsForm(
  {
    defaultValues,
    onSubmit,
    isLoading = false,
    submitLabel = "Save COGS settings",
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
  } = useForm<MenuCogsFormValues>({
    resolver: zodResolver(menuCogsSchema),
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
          field === "recipe_yield" ||
          field === "margin_percent" ||
          field === "vat_percent"
        ) {
          setError(field, { message });
        }
      }
    },
    reset(values?: Partial<MenuCogsFormValues>) {
      reset(buildDefaultValues({ ...initialValuesRef.current, ...values }));
    },
  }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-3 rounded-xl border border-border p-4">
        <p className="text-sm font-medium">COGS configuration</p>

        <div className="space-y-1.5">
          <Label htmlFor="menu-recipe-yield">Recipe yield</Label>
          <Input
            id="menu-recipe-yield"
            type="number"
            step="1"
            min="1"
            inputMode="numeric"
            onKeyDown={blockDecimalInput}
            {...register("recipe_yield", { valueAsNumber: true })}
          />
          <p className="text-xs text-muted-foreground">
            Number of portions produced by the ingredient quantities below
          </p>
          {errors.recipe_yield && (
            <p className="text-sm text-destructive">
              {errors.recipe_yield.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="menu-margin-percent">Margin %</Label>
          <Input
            id="menu-margin-percent"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            {...register("margin_percent", { valueAsNumber: true })}
          />
          <p className="text-xs text-muted-foreground">
            Markup on COGS (30 = sell at 130% of cost)
          </p>
          {errors.margin_percent && (
            <p className="text-sm text-destructive">
              {errors.margin_percent.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="menu-vat-percent">VAT %</Label>
          <Input
            id="menu-vat-percent"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            {...register("vat_percent", { valueAsNumber: true })}
          />
          <p className="text-xs text-muted-foreground">
            VAT added on top of price after margin
          </p>
          {errors.vat_percent && (
            <p className="text-sm text-destructive">
              {errors.vat_percent.message}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" isLoading={isLoading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
});

MenuCogsForm.displayName = "MenuCogsForm";

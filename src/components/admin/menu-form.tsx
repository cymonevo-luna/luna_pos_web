"use client";

import * as React from "react";
import { useEffect, useImperativeHandle, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { menuSchema, type MenuFormValues } from "@/lib/validations";
import { MENU_COGS_DEFAULTS } from "@/lib/menu-cogs";
import { menuPhotoUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export interface MenuCategoryOption {
  id: string;
  name: string;
}

function buildDefaultValues(
  defaultValues?: Partial<MenuFormValues>,
): MenuFormValues {
  return {
    title: defaultValues?.title ?? "",
    description: defaultValues?.description ?? "",
    category_id: defaultValues?.category_id ?? "",
    photo_url: defaultValues?.photo_url ?? "",
    available_stock: defaultValues?.available_stock ?? Number.NaN,
    sell_price: defaultValues?.sell_price ?? Number.NaN,
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

export interface MenuFormProps {
  categories: MenuCategoryOption[];
  defaultValues?: Partial<MenuFormValues>;
  onSubmit: (values: MenuFormValues) => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel?: string;
}

export interface MenuFormHandle {
  applyServerErrors: (fields: Record<string, string>) => void;
  reset: (values?: Partial<MenuFormValues>) => void;
}

export const MenuForm = React.forwardRef<MenuFormHandle, MenuFormProps>(
  function MenuForm(
    {
      categories,
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
      watch,
      formState: { errors },
    } = useForm<MenuFormValues>({
      resolver: zodResolver(menuSchema),
      defaultValues: initialValuesRef.current,
    });

    const photoUrl = watch("photo_url");

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
            field === "category_id" ||
            field === "photo_url" ||
            field === "available_stock" ||
            field === "sell_price" ||
            field === "recipe_yield" ||
            field === "margin_percent" ||
            field === "vat_percent"
          ) {
            setError(field, { message });
          }
        }
      },
      reset(values?: Partial<MenuFormValues>) {
        reset(buildDefaultValues({ ...initialValuesRef.current, ...values }));
      },
    }));

    const categoryOptions = categories.map((category) => ({
      value: category.id,
      label: category.name,
    }));

    const previewSrc = menuPhotoUrl(photoUrl);

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="menu-title">Title</Label>
          <Input id="menu-title" autoComplete="off" {...register("title")} />
          {errors.title && (
            <p className="text-sm text-destructive">{errors.title.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="menu-description">
            Description{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea id="menu-description" rows={3} {...register("description")} />
          {errors.description && (
            <p className="text-sm text-destructive">
              {errors.description.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="menu-category">Category</Label>
          <Select
            id="menu-category"
            options={categoryOptions}
            placeholder="Select a category"
            {...register("category_id")}
          />
          {errors.category_id && (
            <p className="text-sm text-destructive">
              {errors.category_id.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="menu-photo-url">
            Photo URL{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="menu-photo-url"
            type="url"
            autoComplete="off"
            placeholder="https://example.com/photo.jpg"
            {...register("photo_url")}
          />
          <p className="text-xs text-muted-foreground">
            Leave empty to use default food photo
          </p>
          {errors.photo_url && (
            <p className="text-sm text-destructive">{errors.photo_url.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Photo preview</Label>
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewSrc}
              alt="Menu photo preview"
              className="h-full w-full object-cover"
              onError={(event) => {
                event.currentTarget.src = menuPhotoUrl(null);
              }}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="menu-available-stock">Available stock</Label>
          <Input
            id="menu-available-stock"
            type="number"
            step="1"
            min="0"
            inputMode="numeric"
            onKeyDown={blockDecimalInput}
            {...register("available_stock", { valueAsNumber: true })}
          />
          {errors.available_stock && (
            <p className="text-sm text-destructive">
              {errors.available_stock.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="menu-sell-price">Sell price (Rp)</Label>
          <Input
            id="menu-sell-price"
            type="number"
            step="1"
            min="1"
            inputMode="numeric"
            onKeyDown={blockDecimalInput}
            {...register("sell_price", { valueAsNumber: true })}
          />
          {errors.sell_price && (
            <p className="text-sm text-destructive">
              {errors.sell_price.message}
            </p>
          )}
        </div>

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

MenuForm.displayName = "MenuForm";

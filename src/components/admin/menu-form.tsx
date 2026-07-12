"use client";

import * as React from "react";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "@/lib/api/client";
import { uploadMenuPhoto, validateMenuPhotoFile } from "@/lib/api/uploads";
import { menuBasicSchema, type MenuBasicFormValues } from "@/lib/validations";
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
  defaultValues?: Partial<MenuBasicFormValues>,
): MenuBasicFormValues {
  return {
    title: defaultValues?.title ?? "",
    description: defaultValues?.description ?? "",
    category_id: defaultValues?.category_id ?? "",
    photo_url: defaultValues?.photo_url ?? "",
    available_stock: defaultValues?.available_stock ?? Number.NaN,
    sell_price: defaultValues?.sell_price ?? Number.NaN,
  };
}

function blockDecimalInput(event: React.KeyboardEvent<HTMLInputElement>) {
  if (event.key === "." || event.key === "," || event.key === "e" || event.key === "E") {
    event.preventDefault();
  }
}

export interface MenuFormProps {
  categories: MenuCategoryOption[];
  defaultValues?: Partial<MenuBasicFormValues>;
  onSubmit: (values: MenuBasicFormValues) => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel?: string;
}

export interface MenuFormHandle {
  applyServerErrors: (fields: Record<string, string>) => void;
  reset: (values?: Partial<MenuBasicFormValues>) => void;
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
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const {
      register,
      handleSubmit,
      reset,
      setError,
      setValue,
      clearErrors,
      watch,
      formState: { errors },
    } = useForm<MenuBasicFormValues>({
      resolver: zodResolver(menuBasicSchema),
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
            field === "sell_price"
          ) {
            setError(field, { message });
          }
        }
      },
      reset(values?: Partial<MenuBasicFormValues>) {
        reset(buildDefaultValues({ ...initialValuesRef.current, ...values }));
      },
    }));

    const categoryOptions = categories.map((category) => ({
      value: category.id,
      label: category.name,
    }));

    const previewSrc = menuPhotoUrl(photoUrl);
    const isBusy = isLoading || uploading;

    const handleFileChange = async (
      event: React.ChangeEvent<HTMLInputElement>,
    ) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      const validationError = validateMenuPhotoFile(file);
      if (validationError) {
        setUploadError(validationError);
        return;
      }

      setUploadError(null);
      setUploading(true);
      try {
        const data = await uploadMenuPhoto(file);
        setValue("photo_url", data.url, { shouldDirty: true });
        clearErrors("photo_url");
      } catch (err) {
        setUploadError(
          err instanceof ApiError ? err.message : "Failed to upload image",
        );
      } finally {
        setUploading(false);
      }
    };

    const handleRemoveImage = () => {
      setValue("photo_url", "", { shouldDirty: true });
      setUploadError(null);
      clearErrors("photo_url");
    };

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

        <div
          className="grid gap-4 sm:grid-cols-2"
          data-testid="menu-photo-section"
        >
          <div className="space-y-4" data-testid="menu-photo-controls">
            <div className="space-y-1.5">
              <Label htmlFor="menu-photo-file">Menu photo</Label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  id="menu-photo-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={handleFileChange}
                  disabled={isBusy}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  isLoading={uploading}
                  disabled={isBusy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose image
                </Button>
                {photoUrl?.trim() ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isBusy}
                    onClick={handleRemoveImage}
                  >
                    Remove image
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Upload a JPEG, PNG, or WebP image (max 5 MB). Or enter a URL
                below as an optional fallback.
              </p>
              {uploadError ? (
                <p className="text-sm text-destructive">{uploadError}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="menu-photo-url">
                Photo URL{" "}
                <span className="font-normal text-muted-foreground">
                  (optional fallback)
                </span>
              </Label>
              <Input
                id="menu-photo-url"
                type="url"
                autoComplete="off"
                placeholder="https://example.com/photo.jpg"
                disabled={isBusy}
                {...register("photo_url")}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use the default food photo
              </p>
              {errors.photo_url && (
                <p className="text-sm text-destructive">
                  {errors.photo_url.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5 sm:self-start" data-testid="menu-photo-preview">
            <Label>Photo preview</Label>
            <div className="flex aspect-square w-full max-w-[10rem] items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30">
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

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isBusy}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={isBusy}>
            {submitLabel}
          </Button>
        </div>
      </form>
    );
  },
);

MenuForm.displayName = "MenuForm";

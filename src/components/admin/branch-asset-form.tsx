"use client";

import * as React from "react";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "@/lib/api/client";
import {
  uploadBranchAssetPhoto,
  validateMenuPhotoFile,
} from "@/lib/api/uploads";
import {
  branchAssetSchema,
  type BranchAssetFormValues,
} from "@/lib/validations";
import { menuPhotoUrl } from "@/lib/utils";
import { withTitleCaseOnBlur } from "@/lib/withTitleCaseOnBlur";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function buildDefaultValues(
  defaultValues?: Partial<BranchAssetFormValues>,
): BranchAssetFormValues {
  return {
    title: defaultValues?.title ?? "",
    description: defaultValues?.description ?? "",
    quantity: defaultValues?.quantity ?? Number.NaN,
    price_amount: defaultValues?.price_amount ?? Number.NaN,
    photo_url: defaultValues?.photo_url ?? "",
  };
}

export interface BranchAssetFormProps {
  defaultValues?: Partial<BranchAssetFormValues>;
  onSubmit: (values: BranchAssetFormValues) => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel?: string;
}

export interface BranchAssetFormHandle {
  applyServerErrors: (fields: Record<string, string>) => void;
  reset: (values?: Partial<BranchAssetFormValues>) => void;
}

export const BranchAssetForm = React.forwardRef<
  BranchAssetFormHandle,
  BranchAssetFormProps
>(function BranchAssetForm(
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
  } = useForm<BranchAssetFormValues>({
    resolver: zodResolver(branchAssetSchema),
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
          field === "quantity" ||
          field === "price_amount" ||
          field === "photo_url"
        ) {
          setError(field, { message });
        }
      }
    },
    reset(values?: Partial<BranchAssetFormValues>) {
      reset(buildDefaultValues({ ...initialValuesRef.current, ...values }));
    },
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
      const data = await uploadBranchAssetPhoto(file);
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
        <Label htmlFor="branch-asset-title">Title</Label>
        <Input
          id="branch-asset-title"
          autoComplete="off"
          {...withTitleCaseOnBlur(register("title"), setValue, "title")}
        />
        {errors.title && (
          <p className="text-sm text-destructive">{errors.title.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="branch-asset-description">
          Description{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="branch-asset-description"
          rows={3}
          {...register("description")}
        />
        {errors.description && (
          <p className="text-sm text-destructive">
            {errors.description.message}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="branch-asset-quantity">Quantity</Label>
          <Input
            id="branch-asset-quantity"
            type="number"
            step="any"
            min="0"
            inputMode="decimal"
            {...register("quantity", { valueAsNumber: true })}
          />
          {errors.quantity && (
            <p className="text-sm text-destructive">
              {errors.quantity.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="branch-asset-price">Price (Rp)</Label>
          <Input
            id="branch-asset-price"
            type="number"
            step="1"
            min="0"
            inputMode="numeric"
            {...register("price_amount", { valueAsNumber: true })}
          />
          {errors.price_amount && (
            <p className="text-sm text-destructive">
              {errors.price_amount.message}
            </p>
          )}
        </div>
      </div>

      <div
        className="grid gap-4 sm:grid-cols-2"
        data-testid="branch-asset-photo-section"
      >
        <div className="space-y-4" data-testid="branch-asset-photo-controls">
          <div className="space-y-1.5">
            <Label htmlFor="branch-asset-photo-file">
              Photo{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                id="branch-asset-photo-file"
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
              Upload a JPEG, PNG, or WebP image (max 5 MB).
            </p>
            {uploadError ? (
              <p className="text-sm text-destructive">{uploadError}</p>
            ) : null}
          </div>
        </div>

        <div
          className="space-y-1.5 sm:self-start"
          data-testid="branch-asset-photo-preview"
        >
          <Label>Photo preview</Label>
          <div className="flex aspect-square w-full max-w-[10rem] items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewSrc}
              alt="Asset photo preview"
              className="h-full w-full object-cover"
              onError={(event) => {
                event.currentTarget.src = menuPhotoUrl(null);
              }}
            />
          </div>
        </div>
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
});

BranchAssetForm.displayName = "BranchAssetForm";

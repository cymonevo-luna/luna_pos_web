"use client";

import * as React from "react";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "@/lib/api/client";
import { uploadExpenseReceipt, validateMenuPhotoFile } from "@/lib/api/uploads";
import { expenseSchema, type ExpenseFormValues } from "@/lib/validations";
import { menuPhotoUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function buildDefaultValues(
  defaultValues?: Partial<ExpenseFormValues>,
): ExpenseFormValues {
  return {
    title: defaultValues?.title ?? "",
    description: defaultValues?.description ?? "",
    amount: defaultValues?.amount ?? Number.NaN,
    receipt_url: defaultValues?.receipt_url ?? "",
  };
}

function blockDecimalInput(event: React.KeyboardEvent<HTMLInputElement>) {
  if (
    event.key === "." ||
    event.key === "," ||
    event.key === "e" ||
    event.key === "E"
  ) {
    event.preventDefault();
  }
}

function formatUploadError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 413) {
      return "Image is too large. Please choose a file under 5 MB.";
    }
    return err.message;
  }
  return "Failed to upload image";
}

export interface ExpenseFormProps {
  defaultValues?: Partial<ExpenseFormValues>;
  onSubmit: (values: ExpenseFormValues) => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel?: string;
}

export interface ExpenseFormHandle {
  applyServerErrors: (fields: Record<string, string>) => void;
  reset: (values?: Partial<ExpenseFormValues>) => void;
}

export const ExpenseForm = React.forwardRef<ExpenseFormHandle, ExpenseFormProps>(
  function ExpenseForm(
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
    } = useForm<ExpenseFormValues>({
      resolver: zodResolver(expenseSchema),
      defaultValues: initialValuesRef.current,
    });

    const receiptUrl = watch("receipt_url");

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
            field === "amount" ||
            field === "receipt_url"
          ) {
            setError(field, { message });
          }
        }
      },
      reset(values?: Partial<ExpenseFormValues>) {
        reset(buildDefaultValues({ ...initialValuesRef.current, ...values }));
      },
    }));

    const previewSrc = menuPhotoUrl(receiptUrl);
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
        const data = await uploadExpenseReceipt(file);
        setValue("receipt_url", data.url, { shouldDirty: true });
        clearErrors("receipt_url");
      } catch (err) {
        setUploadError(formatUploadError(err));
      } finally {
        setUploading(false);
      }
    };

    const handleRemoveReceipt = () => {
      setValue("receipt_url", "", { shouldDirty: true });
      setUploadError(null);
      clearErrors("receipt_url");
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="expense-title">Title</Label>
          <Input
            id="expense-title"
            autoComplete="off"
            data-testid="expense-title-input"
            {...register("title")}
          />
          {errors.title && (
            <p className="text-sm text-destructive">{errors.title.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="expense-description">
            Description{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="expense-description"
            rows={3}
            data-testid="expense-description-input"
            {...register("description")}
          />
          {errors.description && (
            <p className="text-sm text-destructive">
              {errors.description.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="expense-amount">Amount (Rp)</Label>
          <Input
            id="expense-amount"
            type="number"
            step="1"
            min="1"
            inputMode="numeric"
            data-testid="expense-amount-input"
            onKeyDown={blockDecimalInput}
            {...register("amount", { valueAsNumber: true })}
          />
          {errors.amount && (
            <p className="text-sm text-destructive">{errors.amount.message}</p>
          )}
        </div>

        <div
          className="grid gap-4 sm:grid-cols-2"
          data-testid="expense-receipt-section"
        >
          <div className="space-y-4" data-testid="expense-receipt-controls">
            <div className="space-y-1.5">
              <Label htmlFor="expense-receipt-file">
                Receipt{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  id="expense-receipt-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  data-testid="expense-receipt-file-input"
                  onChange={handleFileChange}
                  disabled={isBusy}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  isLoading={uploading}
                  disabled={isBusy}
                  data-testid="expense-receipt-choose-button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {receiptUrl?.trim() ? "Replace image" : "Choose image"}
                </Button>
                {receiptUrl?.trim() ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isBusy}
                    data-testid="expense-receipt-remove-button"
                    onClick={handleRemoveReceipt}
                  >
                    Remove image
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Upload a JPEG, PNG, or WebP image (max 5 MB).
              </p>
              {uploadError ? (
                <p
                  className="text-sm text-destructive"
                  data-testid="expense-receipt-upload-error"
                >
                  {uploadError}
                </p>
              ) : null}
              {errors.receipt_url && (
                <p className="text-sm text-destructive">
                  {errors.receipt_url.message}
                </p>
              )}
            </div>
          </div>

          <div
            className="space-y-1.5 sm:self-start"
            data-testid="expense-receipt-preview"
          >
            <Label>Receipt preview</Label>
            <div className="flex aspect-square w-full max-w-[10rem] items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewSrc}
                alt="Receipt preview"
                className="h-full w-full object-cover"
                data-testid="expense-receipt-preview-image"
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
            data-testid="expense-form-cancel"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isBusy}
            data-testid="expense-form-submit"
          >
            {submitLabel}
          </Button>
        </div>
      </form>
    );
  },
);

ExpenseForm.displayName = "ExpenseForm";

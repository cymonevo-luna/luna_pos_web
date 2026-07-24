"use client";

import * as React from "react";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "@/lib/api/client";
import { uploadExpenseReceipt, validateMenuPhotoFile } from "@/lib/api/uploads";
import {
  expenseEditWithRecordDateSchema,
  expenseSchema,
  type ExpenseFormValues,
} from "@/lib/validations";
import {
  dateToDatetimeLocalInput,
  menuPhotoUrl,
  formatRupiah,
} from "@/lib/utils";
import { withTitleCaseOnBlur } from "@/lib/withTitleCaseOnBlur";
import { useCashierBalance } from "@/lib/hooks/use-cashier-balance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const SOURCE_OF_FUND_OPTIONS = [
  { value: "CASHIER", label: "Cashier" },
  { value: "PERSONAL_MONEY", label: "Personal Money" },
] as const;

function CashierBalanceHint() {
  const { balance, loading } = useCashierBalance();

  if (loading) {
    return (
      <p
        className="text-xs text-muted-foreground"
        data-testid="expense-cashier-balance-loading"
      >
        Loading cashier balance…
      </p>
    );
  }

  return (
    <p
      className="text-xs text-muted-foreground"
      data-testid="expense-cashier-balance-hint"
    >
      Current cashier balance: {formatRupiah(balance?.balance ?? 0)}
    </p>
  );
}

function buildDefaultValues(
  defaultValues?: Partial<ExpenseFormValues>,
): ExpenseFormValues {
  return {
    title: defaultValues?.title ?? "",
    description: defaultValues?.description ?? "",
    amount: defaultValues?.amount ?? Number.NaN,
    source_of_fund: defaultValues?.source_of_fund ?? "PERSONAL_MONEY",
    receipt_url: defaultValues?.receipt_url ?? "",
    recordDate: defaultValues?.recordDate,
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
  showRecordDate?: boolean;
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
      showRecordDate = false,
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
      control,
      formState: { errors },
    } = useForm<ExpenseFormValues>({
      resolver: zodResolver(
        showRecordDate ? expenseEditWithRecordDateSchema : expenseSchema,
      ) as Resolver<ExpenseFormValues>,
      defaultValues: initialValuesRef.current,
    });

    const receiptUrl = watch("receipt_url");
    const sourceOfFund = watch("source_of_fund");

    useEffect(() => {
      const values = buildDefaultValues(defaultValues);
      initialValuesRef.current = values;
      reset(values);
    }, [defaultValues, reset]);

    useImperativeHandle(ref, () => ({
      applyServerErrors(fields: Record<string, string>) {
        for (const [field, message] of Object.entries(fields)) {
          const mappedField =
            field === "record_date"
              ? "recordDate"
              : field === "title" ||
                  field === "description" ||
                  field === "amount" ||
                  field === "source_of_fund" ||
                  field === "receipt_url"
                ? field
                : null;
          if (mappedField) {
            setError(mappedField, { message });
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
            {...withTitleCaseOnBlur(register("title"), setValue, "title")}
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

        {showRecordDate ? (
          <div className="space-y-1.5" data-testid="expense-record-date-section">
            <Label htmlFor="expense-record-date">Reporting date</Label>
            <Controller
              name="recordDate"
              control={control}
              render={({ field }) => (
                <Input
                  id="expense-record-date"
                  type="datetime-local"
                  data-testid="expense-record-date-input"
                  value={
                    field.value instanceof Date && !Number.isNaN(field.value.getTime())
                      ? dateToDatetimeLocalInput(field.value)
                      : ""
                  }
                  onChange={(event) => {
                    const value = event.target.value;
                    field.onChange(value ? new Date(value) : undefined);
                  }}
                  onBlur={field.onBlur}
                  ref={field.ref}
                />
              )}
            />
            <p className="text-xs text-muted-foreground">
              Reporting date used for cash-flow calculations.
            </p>
            {errors.recordDate && (
              <p
                className="text-sm text-destructive"
                data-testid="expense-record-date-error"
              >
                {errors.recordDate.message}
              </p>
            )}
          </div>
        ) : null}

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

        <div className="space-y-1.5">
          <Label htmlFor="expense-source-of-fund">Source of Fund</Label>
          <Select
            id="expense-source-of-fund"
            options={[...SOURCE_OF_FUND_OPTIONS]}
            data-testid="expense-source-of-fund-select"
            {...register("source_of_fund")}
          />
          {sourceOfFund === "CASHIER" ? <CashierBalanceHint /> : null}
          {errors.source_of_fund && (
            <p
              className="text-sm text-destructive"
              data-testid="expense-source-of-fund-error"
            >
              {errors.source_of_fund.message}
            </p>
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

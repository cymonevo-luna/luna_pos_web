"use client";

import * as React from "react";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "@/lib/api/client";
import type { Staff } from "@/lib/api/types";
import {
  uploadStaffKtpPhoto,
  validateMenuPhotoFile,
} from "@/lib/api/uploads";
import {
  staffSchema,
  type StaffFormValues,
} from "@/lib/validations";
import { menuPhotoUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function buildDefaultStaffValues(
  defaultValues?: Partial<StaffFormValues>,
): StaffFormValues {
  return {
    name: defaultValues?.name ?? "",
    nik: defaultValues?.nik ?? "",
    ktp_photo_url: defaultValues?.ktp_photo_url ?? "",
    address: defaultValues?.address ?? "",
    job_title: defaultValues?.job_title ?? "",
    salary_amount:
      defaultValues?.salary_amount && defaultValues.salary_amount !== 0
        ? defaultValues.salary_amount
        : undefined,
    benefits: defaultValues?.benefits ?? "",
  };
}

export function staffToFormValues(staff: Staff): StaffFormValues {
  return {
    name: staff.name,
    nik: staff.nik,
    ktp_photo_url: staff.ktp_photo_url ?? "",
    address: staff.address,
    job_title: staff.job_title,
    salary_amount:
      staff.salary_amount === 0 ? undefined : staff.salary_amount,
    benefits: staff.benefits ?? "",
  };
}

function blockDecimalInput(event: React.KeyboardEvent<HTMLInputElement>) {
  if (event.key === "." || event.key === "," || event.key === "e" || event.key === "E") {
    event.preventDefault();
  }
}

export interface StaffFormProps {
  defaultValues?: Partial<StaffFormValues>;
  /** Linked recurring expense from staff API (read-only; backend-managed). */
  recurringExpenseId?: string | null;
  onSubmit: (values: StaffFormValues) => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel?: string;
}

export interface StaffFormHandle {
  applyServerErrors: (fields: Record<string, string>) => void;
  reset: (values?: Partial<StaffFormValues>) => void;
}

export const StaffForm = React.forwardRef<StaffFormHandle, StaffFormProps>(
  function StaffForm(
    {
      defaultValues,
      recurringExpenseId,
      onSubmit,
      onCancel,
      isLoading = false,
      submitLabel = "Save",
    },
    ref,
  ) {
    const initialValuesRef = useRef(buildDefaultStaffValues(defaultValues));
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
    } = useForm<StaffFormValues>({
      resolver: zodResolver(staffSchema),
      defaultValues: initialValuesRef.current,
    });

    const ktpPhotoUrl = watch("ktp_photo_url");

    useEffect(() => {
      const values = buildDefaultStaffValues(defaultValues);
      initialValuesRef.current = values;
      reset(values);
    }, [defaultValues, reset]);

    useImperativeHandle(ref, () => ({
      applyServerErrors(fields: Record<string, string>) {
        for (const [field, message] of Object.entries(fields)) {
          if (
            field === "name" ||
            field === "nik" ||
            field === "ktp_photo_url" ||
            field === "address" ||
            field === "job_title" ||
            field === "salary_amount" ||
            field === "benefits"
          ) {
            setError(field, { message });
          }
        }
      },
      reset(values?: Partial<StaffFormValues>) {
        reset(buildDefaultStaffValues({ ...initialValuesRef.current, ...values }));
      },
    }));

    const previewSrc = menuPhotoUrl(ktpPhotoUrl);
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
        const data = await uploadStaffKtpPhoto(file);
        setValue("ktp_photo_url", data.url, { shouldDirty: true });
        clearErrors("ktp_photo_url");
      } catch (err) {
        setUploadError(
          err instanceof ApiError ? err.message : "Failed to upload image",
        );
      } finally {
        setUploading(false);
      }
    };

    const handleRemoveImage = () => {
      setValue("ktp_photo_url", "", { shouldDirty: true });
      setUploadError(null);
      clearErrors("ktp_photo_url");
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="staff-name">Name</Label>
          <Input
            id="staff-name"
            autoComplete="off"
            {...register("name")}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="staff-nik">NIK</Label>
          <Input
            id="staff-nik"
            autoComplete="off"
            inputMode="numeric"
            maxLength={16}
            {...register("nik")}
          />
          {errors.nik && (
            <p className="text-sm text-destructive">{errors.nik.message}</p>
          )}
        </div>

        <div
          className="grid gap-4 sm:grid-cols-2"
          data-testid="staff-ktp-photo-section"
        >
          <div className="space-y-4" data-testid="staff-ktp-photo-controls">
            <div className="space-y-1.5">
              <Label htmlFor="staff-ktp-photo-file">KTP photo</Label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  id="staff-ktp-photo-file"
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
                {ktpPhotoUrl?.trim() ? (
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
              {errors.ktp_photo_url && (
                <p className="text-sm text-destructive">
                  {errors.ktp_photo_url.message}
                </p>
              )}
            </div>
          </div>

          <div
            className="space-y-1.5 sm:self-start"
            data-testid="staff-ktp-photo-preview"
          >
            <Label>KTP preview</Label>
            <div className="flex aspect-[3/2] w-full max-w-[12rem] items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewSrc}
                alt="KTP photo preview"
                className="h-full w-full object-cover"
                onError={(event) => {
                  event.currentTarget.src = menuPhotoUrl(null);
                }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="staff-address">Address</Label>
          <Textarea id="staff-address" rows={3} {...register("address")} />
          {errors.address && (
            <p className="text-sm text-destructive">{errors.address.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="staff-job-title">Job title</Label>
          <Input
            id="staff-job-title"
            autoComplete="off"
            {...register("job_title")}
          />
          {errors.job_title && (
            <p className="text-sm text-destructive">
              {errors.job_title.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="staff-salary">Salary (optional)</Label>
          <p className="text-xs text-muted-foreground">
            Leave blank if no fixed salary
          </p>
          <Input
            id="staff-salary"
            type="number"
            step="1"
            min="0"
            inputMode="numeric"
            onKeyDown={blockDecimalInput}
            {...register("salary_amount", { valueAsNumber: true })}
          />
          {errors.salary_amount && (
            <p className="text-sm text-destructive">
              {errors.salary_amount.message}
            </p>
          )}
          {recurringExpenseId ? (
            <p
              className="text-xs text-muted-foreground"
              data-testid="staff-recurring-expense-notice"
            >
              A recurring expense is automatically managed for this salary.
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="staff-benefits">
            Benefits{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea id="staff-benefits" rows={3} {...register("benefits")} />
          {errors.benefits && (
            <p className="text-sm text-destructive">{errors.benefits.message}</p>
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

StaffForm.displayName = "StaffForm";

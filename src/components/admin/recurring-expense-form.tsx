"use client";

import * as React from "react";
import { useEffect, useImperativeHandle, useRef } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  recurringExpenseSchema,
  type RecurringExpenseFormValues,
} from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const INTERVAL_OPTIONS = [
  { value: "DATE", label: "Monthly (day of month)" },
  { value: "DAY", label: "Weekly (weekday)" },
  { value: "DAILY", label: "Daily" },
];

const WEEKDAY_OPTIONS = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "7", label: "Sunday" },
];

function buildDefaultValues(
  defaultValues?: Partial<RecurringExpenseFormValues>,
): RecurringExpenseFormValues {
  return {
    title: defaultValues?.title ?? "",
    description: defaultValues?.description ?? "",
    amount: defaultValues?.amount ?? Number.NaN,
    is_active: defaultValues?.is_active ?? true,
    recurring: {
      interval: defaultValues?.recurring?.interval ?? "DAY",
      value: defaultValues?.recurring?.value ?? Number.NaN,
      time: {
        hour: defaultValues?.recurring?.time?.hour ?? Number.NaN,
        minute: defaultValues?.recurring?.time?.minute ?? Number.NaN,
        second: defaultValues?.recurring?.time?.second ?? 0,
      },
    },
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

export interface RecurringExpenseFormProps {
  defaultValues?: Partial<RecurringExpenseFormValues>;
  onSubmit: (values: RecurringExpenseFormValues) => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel?: string;
  showIsActive?: boolean;
  /** When true, all fields are disabled and submit is hidden (staff-managed records). */
  readOnly?: boolean;
}

export interface RecurringExpenseFormHandle {
  applyServerErrors: (fields: Record<string, string>) => void;
  reset: (values?: Partial<RecurringExpenseFormValues>) => void;
}

export const RecurringExpenseForm = React.forwardRef<
  RecurringExpenseFormHandle,
  RecurringExpenseFormProps
>(function RecurringExpenseForm(
  {
    defaultValues,
    onSubmit,
    onCancel,
    isLoading = false,
    submitLabel = "Save",
    showIsActive = false,
    readOnly = false,
  },
  ref,
) {
  const initialValuesRef = useRef(buildDefaultValues(defaultValues));
  const fieldsDisabled = readOnly || isLoading;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    clearErrors,
    watch,
    formState: { errors },
  } = useForm<RecurringExpenseFormValues>({
    resolver: zodResolver(recurringExpenseSchema),
    defaultValues: initialValuesRef.current,
  });

  const interval = watch("recurring.interval");

  useEffect(() => {
    const values = buildDefaultValues(defaultValues);
    initialValuesRef.current = values;
    reset(values);
  }, [defaultValues, reset]);

  useEffect(() => {
    if (interval === "DAILY") {
      setValue("recurring.value", undefined);
      clearErrors("recurring.value");
    }
  }, [interval, setValue, clearErrors]);

  useImperativeHandle(ref, () => ({
    applyServerErrors(fields: Record<string, string>) {
      const knownFields: FieldPath<RecurringExpenseFormValues>[] = [
        "title",
        "description",
        "amount",
        "is_active",
        "recurring.interval",
        "recurring.value",
        "recurring.time.hour",
        "recurring.time.minute",
        "recurring.time.second",
      ];

      for (const [field, message] of Object.entries(fields)) {
        if (
          knownFields.includes(
            field as FieldPath<RecurringExpenseFormValues>,
          )
        ) {
          setError(field as FieldPath<RecurringExpenseFormValues>, {
            message,
          });
        }
      }
    },
    reset(values?: Partial<RecurringExpenseFormValues>) {
      reset(buildDefaultValues({ ...initialValuesRef.current, ...values }));
    },
  }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {readOnly && (
        <p
          className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
          data-testid="recurring-expense-readonly-notice"
        >
          This recurring expense is managed via Staff salary and is read-only
          here.
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="recurring-expense-title">Title</Label>
        <Input
          id="recurring-expense-title"
          autoComplete="off"
          disabled={fieldsDisabled}
          {...register("title")}
        />
        {errors.title && (
          <p className="text-sm text-destructive">{errors.title.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="recurring-expense-description">
          Description{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="recurring-expense-description"
          rows={3}
          disabled={fieldsDisabled}
          {...register("description")}
        />
        {errors.description && (
          <p className="text-sm text-destructive">
            {errors.description.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="recurring-expense-amount">Amount (Rp)</Label>
        <Input
          id="recurring-expense-amount"
          type="number"
          step="1"
          min="1"
          inputMode="numeric"
          disabled={fieldsDisabled}
          onKeyDown={blockDecimalInput}
          {...register("amount", { valueAsNumber: true })}
        />
        {errors.amount && (
          <p className="text-sm text-destructive">{errors.amount.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="recurring-expense-interval">Schedule interval</Label>
        <Select
          id="recurring-expense-interval"
          options={INTERVAL_OPTIONS}
          disabled={fieldsDisabled}
          {...register("recurring.interval")}
        />
        {errors.recurring?.interval && (
          <p className="text-sm text-destructive">
            {errors.recurring.interval.message}
          </p>
        )}
      </div>

      {interval === "DATE" && (
        <div className="space-y-1.5" data-testid="recurring-expense-value-field">
          <Label htmlFor="recurring-expense-day-of-month">Day of month</Label>
          <Input
            id="recurring-expense-day-of-month"
            type="number"
            min="1"
            max="31"
            step="1"
            inputMode="numeric"
            disabled={fieldsDisabled}
            onKeyDown={blockDecimalInput}
            {...register("recurring.value", { valueAsNumber: true })}
          />
          <p className="text-xs text-muted-foreground">
            Enter a day between 1 and 31. Shorter months run on their last day.
          </p>
          {errors.recurring?.value && (
            <p className="text-sm text-destructive">
              {errors.recurring.value.message}
            </p>
          )}
        </div>
      )}

      {interval === "DAY" && (
        <div className="space-y-1.5" data-testid="recurring-expense-value-field">
          <Label htmlFor="recurring-expense-weekday">Weekday</Label>
          <Select
            id="recurring-expense-weekday"
            placeholder="Select weekday"
            options={WEEKDAY_OPTIONS}
            disabled={fieldsDisabled}
            {...register("recurring.value", {
              setValueAs: (value) => {
                if (value === "" || value === null || value === undefined) {
                  return Number.NaN;
                }
                const parsed = Number(value);
                return Number.isFinite(parsed) ? parsed : Number.NaN;
              },
            })}
          />
          {errors.recurring?.value && (
            <p className="text-sm text-destructive">
              {errors.recurring.value.message}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="recurring-expense-hour">Hour</Label>
          <Input
            id="recurring-expense-hour"
            type="number"
            min="0"
            max="23"
            step="1"
            inputMode="numeric"
            disabled={fieldsDisabled}
            onKeyDown={blockDecimalInput}
            {...register("recurring.time.hour", { valueAsNumber: true })}
          />
          {errors.recurring?.time?.hour && (
            <p className="text-sm text-destructive">
              {errors.recurring.time.hour.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="recurring-expense-minute">Minute</Label>
          <Input
            id="recurring-expense-minute"
            type="number"
            min="0"
            max="59"
            step="1"
            inputMode="numeric"
            disabled={fieldsDisabled}
            onKeyDown={blockDecimalInput}
            {...register("recurring.time.minute", { valueAsNumber: true })}
          />
          {errors.recurring?.time?.minute && (
            <p className="text-sm text-destructive">
              {errors.recurring.time.minute.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="recurring-expense-second">Second</Label>
          <Input
            id="recurring-expense-second"
            type="number"
            min="0"
            max="59"
            step="1"
            inputMode="numeric"
            disabled={fieldsDisabled}
            onKeyDown={blockDecimalInput}
            {...register("recurring.time.second", { valueAsNumber: true })}
          />
          {errors.recurring?.time?.second && (
            <p className="text-sm text-destructive">
              {errors.recurring.time.second.message}
            </p>
          )}
        </div>
      </div>

      {showIsActive && (
        <div className="flex items-center gap-2">
          <input
            id="recurring-expense-is-active"
            type="checkbox"
            className="border-input h-4 w-4 rounded border"
            disabled={fieldsDisabled}
            {...register("is_active")}
          />
          <Label htmlFor="recurring-expense-is-active">Active</Label>
        </div>
      )}
      {errors.is_active && (
        <p className="text-sm text-destructive">{errors.is_active.message}</p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          {readOnly ? "Close" : "Cancel"}
        </Button>
        {!readOnly && (
          <Button type="submit" isLoading={isLoading}>
            {submitLabel}
          </Button>
        )}
      </div>
    </form>
  );
});

RecurringExpenseForm.displayName = "RecurringExpenseForm";

"use client";

import * as React from "react";
import { useEffect, useImperativeHandle, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  adminUserCreateSchema,
  type AdminUserCreateFormValues,
} from "@/lib/validations";
import { ASSIGNABLE_ROLES, formatRoleLabel } from "@/lib/auth/roles";
import type { MerchantRole } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

function buildDefaultValues(
  defaultValues?: Partial<AdminUserCreateFormValues>,
): AdminUserCreateFormValues {
  return {
    email: defaultValues?.email ?? "",
    name: defaultValues?.name ?? "",
    password: defaultValues?.password ?? "",
    roles: defaultValues?.roles ?? [],
  };
}

export interface AdminUserCreateFormProps {
  defaultValues?: Partial<AdminUserCreateFormValues>;
  onSubmit: (values: AdminUserCreateFormValues) => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel?: string;
}

export interface AdminUserCreateFormHandle {
  applyServerErrors: (fields: Record<string, string>) => void;
  reset: (values?: Partial<AdminUserCreateFormValues>) => void;
}

export const AdminUserCreateForm = React.forwardRef<
  AdminUserCreateFormHandle,
  AdminUserCreateFormProps
>(function AdminUserCreateForm(
  {
    defaultValues,
    onSubmit,
    onCancel,
    isLoading = false,
    submitLabel = "Create user",
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
    setValue,
    formState: { errors },
  } = useForm<AdminUserCreateFormValues>({
    resolver: zodResolver(adminUserCreateSchema),
    defaultValues: initialValuesRef.current,
  });

  const selectedRoles = watch("roles");

  useEffect(() => {
    const values = buildDefaultValues(defaultValues);
    initialValuesRef.current = values;
    reset(values);
  }, [defaultValues, reset]);

  useImperativeHandle(ref, () => ({
    applyServerErrors(fields: Record<string, string>) {
      for (const [field, message] of Object.entries(fields)) {
        if (
          field === "email" ||
          field === "name" ||
          field === "password" ||
          field === "roles"
        ) {
          setError(field as keyof AdminUserCreateFormValues, { message });
        }
      }
    },
    reset(values?: Partial<AdminUserCreateFormValues>) {
      reset(buildDefaultValues({ ...initialValuesRef.current, ...values }));
    },
  }));

  const toggleRole = (role: MerchantRole) => {
    const next = selectedRoles.includes(role)
      ? selectedRoles.filter((entry) => entry !== role)
      : [...selectedRoles, role];
    setValue("roles", next, { shouldValidate: true });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="admin-user-email">Email</Label>
        <Input
          id="admin-user-email"
          type="email"
          autoComplete="off"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="admin-user-name">Name</Label>
        <Input id="admin-user-name" autoComplete="off" {...register("name")} />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="admin-user-password">Password</Label>
        <PasswordInput
          id="admin-user-password"
          autoComplete="new-password"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Roles</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ASSIGNABLE_ROLES.map((role) => (
            <label
              key={role}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                className="border-input h-4 w-4 rounded border"
                checked={selectedRoles.includes(role)}
                onChange={() => toggleRole(role)}
              />
              <span>{formatRoleLabel(role)}</span>
            </label>
          ))}
        </div>
        {errors.roles && (
          <p className="text-sm text-destructive">{errors.roles.message}</p>
        )}
      </fieldset>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isLoading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
});

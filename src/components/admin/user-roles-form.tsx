"use client";

import * as React from "react";
import { useEffect, useImperativeHandle, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  adminUserRolesSchema,
  type AdminUserRolesFormValues,
} from "@/lib/validations";
import {
  ASSIGNABLE_ROLES,
  formatRoleLabel,
  wouldRemoveLastAdmin,
} from "@/lib/auth/roles";
import type { MerchantRole, User } from "@/lib/api/types";
import { Button } from "@/components/ui/button";

function buildDefaultValues(
  defaultValues?: Partial<AdminUserRolesFormValues>,
): AdminUserRolesFormValues {
  return {
    roles: defaultValues?.roles ?? [],
  };
}

export interface AdminUserRolesFormProps {
  user: User;
  allUsers: User[];
  defaultValues?: Partial<AdminUserRolesFormValues>;
  onSubmit: (values: AdminUserRolesFormValues) => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel?: string;
}

export interface AdminUserRolesFormHandle {
  applyServerErrors: (fields: Record<string, string>) => void;
  reset: (values?: Partial<AdminUserRolesFormValues>) => void;
}

export const AdminUserRolesForm = React.forwardRef<
  AdminUserRolesFormHandle,
  AdminUserRolesFormProps
>(function AdminUserRolesForm(
  {
    user,
    allUsers,
    defaultValues,
    onSubmit,
    onCancel,
    isLoading = false,
    submitLabel = "Save roles",
  },
  ref,
) {
  const initialValuesRef = useRef(buildDefaultValues(defaultValues));

  const {
    handleSubmit,
    reset,
    setError,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AdminUserRolesFormValues>({
    resolver: zodResolver(adminUserRolesSchema),
    defaultValues: initialValuesRef.current,
  });

  const selectedRoles = watch("roles");
  const lastAdminWarning = wouldRemoveLastAdmin(user, selectedRoles, allUsers);

  useEffect(() => {
    const values = buildDefaultValues(defaultValues);
    initialValuesRef.current = values;
    reset(values);
  }, [defaultValues, reset]);

  useImperativeHandle(ref, () => ({
    applyServerErrors(fields: Record<string, string>) {
      for (const [field, message] of Object.entries(fields)) {
        if (field === "roles") {
          setError("roles", { message });
        }
      }
    },
    reset(values?: Partial<AdminUserRolesFormValues>) {
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
      <div className="space-y-1">
        <p className="text-sm font-medium">{user.name}</p>
        <p className="text-sm text-muted-foreground">{user.email}</p>
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

      {lastAdminWarning && (
        <div
          role="alert"
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          Removing the admin role from this user would leave the merchant
          without an administrator.
        </div>
      )}

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

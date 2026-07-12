"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Plus,
  Pencil,
} from "lucide-react";
import {
  adminApi,
  adminUserCreateFormToPayload,
  adminUserRolesFormToPayload,
} from "@/lib/api/users";
import { ApiError } from "@/lib/api/client";
import type { User } from "@/lib/api/types";
import type {
  AdminUserCreateFormValues,
  AdminUserRolesFormValues,
} from "@/lib/validations";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/lib/auth/context";
import { toast } from "sonner";
import {
  AdminUserCreateForm,
  type AdminUserCreateFormHandle,
} from "@/components/admin/user-create-form";
import {
  AdminUserRolesForm,
  type AdminUserRolesFormHandle,
} from "@/components/admin/user-roles-form";
import { UserRoleBadges } from "@/components/admin/user-role-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Dialog, DialogTitle } from "@/components/ui/dialog";

const PER_PAGE = 10;

type UserDialogState =
  | { mode: "create" }
  | { mode: "edit-roles"; user: User }
  | null;

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dialog, setDialog] = useState<UserDialogState>(null);
  const [saving, setSaving] = useState(false);
  const createFormRef = useRef<AdminUserCreateFormHandle>(null);
  const rolesFormRef = useRef<AdminUserRolesFormHandle>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listUsers({
        page,
        perPage: PER_PAGE,
        search: debounced,
      });
      setUsers(res.data ?? []);
      setTotal(res.meta?.total ?? 0);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, debounced]);

  useEffect(() => {
    void load();
  }, [load]);

  const closeDialog = () => {
    if (saving) return;
    setDialog(null);
  };

  const handleCreateSubmit = async (values: AdminUserCreateFormValues) => {
    setSaving(true);
    try {
      await adminApi.createUser(adminUserCreateFormToPayload(values));
      toast.success("User created");
      setDialog(null);
      void load();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields) {
          createFormRef.current?.applyServerErrors(err.fields);
        }
        toast.error(err.message);
      } else {
        toast.error("Failed to create user");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRolesSubmit = async (values: AdminUserRolesFormValues) => {
    if (!dialog || dialog.mode !== "edit-roles") return;
    setSaving(true);
    try {
      await adminApi.updateUserRoles(
        dialog.user.id,
        adminUserRolesFormToPayload(values),
      );
      toast.success("Roles updated");
      setDialog(null);
      void load();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields) {
          rolesFormRef.current?.applyServerErrors(err.fields);
        }
        toast.error(err.message);
      } else {
        toast.error("Failed to update roles");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await adminApi.deleteUser(pendingDelete.id);
      toast.success("User removed from merchant");
      setPendingDelete(null);
      void load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to remove user",
      );
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Users</h2>
          <p className="text-muted-foreground">{total} total</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => setDialog({ mode: "create" })}>
            <Plus className="h-4 w-4" />
            Create user
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Roles</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-destructive"
                  >
                    {error}
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.email}
                    </td>
                    <td className="px-4 py-3">
                      <UserRoleBadges roles={u.roles} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(u.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/users/${u.id}`}
                          aria-label="View user"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Edit roles"
                          onClick={() => setDialog({ mode: "edit-roles", user: u })}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          aria-label="Remove user"
                          disabled={u.id === currentUser?.id}
                          onClick={() => setPendingDelete(u)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={dialog?.mode === "create"} onClose={closeDialog}>
        <DialogTitle>Create user</DialogTitle>
        <AdminUserCreateForm
          ref={createFormRef}
          onSubmit={handleCreateSubmit}
          onCancel={closeDialog}
          isLoading={saving}
        />
      </Dialog>

      <Dialog
        open={dialog?.mode === "edit-roles"}
        onClose={closeDialog}
        className="max-w-lg"
      >
        <DialogTitle>Edit roles</DialogTitle>
        {dialog?.mode === "edit-roles" && (
          <AdminUserRolesForm
            ref={rolesFormRef}
            user={dialog.user}
            allUsers={users}
            defaultValues={{ roles: dialog.user.roles }}
            onSubmit={handleRolesSubmit}
            onCancel={closeDialog}
            isLoading={saving}
          />
        )}
      </Dialog>

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold">Remove user</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to remove{" "}
              <span className="font-medium text-foreground">
                {pendingDelete.name}
              </span>{" "}
              from this merchant? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                isLoading={deleting}
              >
                Remove
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

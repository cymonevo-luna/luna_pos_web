"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
} from "lucide-react";
import { staffAdminApi, staffFormToPayload } from "@/lib/api/staff";
import { ApiError } from "@/lib/api/client";
import type { Staff } from "@/lib/api/types";
import type { StaffFormValues } from "@/lib/validations";
import { formatRupiah } from "@/lib/utils";
import { toast } from "sonner";
import {
  StaffForm,
  staffToFormValues,
  type StaffFormHandle,
} from "@/components/admin/staff-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

const PER_PAGE = 10;

function StaffRecurringPayoutCell({ staff }: { staff: Staff }) {
  if (staff.recurring_expense_id) {
    return (
      <Badge
        variant="success"
        data-testid="staff-recurring-payout-active"
      >
        Active
      </Badge>
    );
  }

  return (
    <span className="text-muted-foreground" data-testid="staff-recurring-payout-none">
      —
    </span>
  );
}

type StaffDialogState =
  | { mode: "create" }
  | { mode: "edit"; staff: Staff }
  | null;

export default function AdminStaffPage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Staff | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dialog, setDialog] = useState<StaffDialogState>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<StaffFormHandle>(null);

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
      const res = await staffAdminApi.list({
        page,
        perPage: PER_PAGE,
        search: debounced,
      });
      setStaffList(res.data ?? []);
      setTotal(res.meta?.total ?? 0);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load staff",
      );
    } finally {
      setLoading(false);
    }
  }, [page, debounced]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await staffAdminApi.delete(pendingDelete.id);
      toast.success("Staff deleted");
      setPendingDelete(null);
      void load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete staff",
      );
    } finally {
      setDeleting(false);
    }
  };

  const closeDialog = () => {
    if (saving) return;
    setDialog(null);
  };

  const handleFormSubmit = async (values: StaffFormValues) => {
    if (!dialog) return;
    setSaving(true);
    try {
      const payload = staffFormToPayload(values);
      if (dialog.mode === "create") {
        await staffAdminApi.create(payload);
        toast.success("Staff created");
      } else {
        await staffAdminApi.update(dialog.staff.id, payload);
        toast.success("Staff updated");
      }
      setDialog(null);
      void load();
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        formRef.current?.applyServerErrors(err.fields);
      }
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save staff",
      );
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const dialogTitle =
    dialog?.mode === "edit" ? "Edit staff" : "Add staff";

  const formDefaultValues =
    dialog?.mode === "edit" ? staffToFormValues(dialog.staff) : undefined;

  return (
    <div className="space-y-6" data-testid="staff-page">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Staff</h2>
          <p className="text-muted-foreground">{total} total</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, NIK, or job title"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => setDialog({ mode: "create" })}>
            <Plus className="h-4 w-4" />
            Add staff
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">NIK</th>
                <th className="px-4 py-3 font-medium">Job title</th>
                <th className="px-4 py-3 font-medium">Salary</th>
                <th className="px-4 py-3 font-medium">Recurring payout</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-destructive"
                  >
                    {error}
                  </td>
                </tr>
              ) : staffList.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No staff found.
                  </td>
                </tr>
              ) : (
                staffList.map((staff) => (
                  <tr
                    key={staff.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">{staff.name}</td>
                    <td className="px-4 py-3">{staff.nik}</td>
                    <td className="px-4 py-3">{staff.job_title}</td>
                    <td className="px-4 py-3">
                      {staff.salary_amount === 0
                        ? "Not set"
                        : formatRupiah(staff.salary_amount)}
                    </td>
                    <td className="px-4 py-3">
                      <StaffRecurringPayoutCell staff={staff} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Edit staff"
                          onClick={() =>
                            setDialog({ mode: "edit", staff })
                          }
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          aria-label="Delete staff"
                          onClick={() => setPendingDelete(staff)}
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

      <Dialog open={dialog !== null} onClose={closeDialog} className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogTitle>{dialogTitle}</DialogTitle>
        {dialog && (
          <StaffForm
            key={
              dialog.mode === "edit" ? `edit-${dialog.staff.id}` : "create"
            }
            ref={formRef}
            defaultValues={formDefaultValues}
            recurringExpenseId={
              dialog.mode === "edit"
                ? dialog.staff.recurring_expense_id
                : undefined
            }
            onSubmit={handleFormSubmit}
            onCancel={closeDialog}
            isLoading={saving}
            submitLabel={dialog.mode === "edit" ? "Save changes" : "Add staff"}
          />
        )}
      </Dialog>

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold">Delete staff</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {pendingDelete.name}
              </span>
              ? This action cannot be undone.
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
                Delete
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

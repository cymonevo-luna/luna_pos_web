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
import {
  branchAssetsAdminApi,
  branchAssetFormToPayload,
} from "@/lib/api/branch-assets";
import { ApiError } from "@/lib/api/client";
import type { BranchAsset } from "@/lib/api/types";
import type { BranchAssetFormValues } from "@/lib/validations";
import { displayDescription, formatRupiah, menuPhotoUrl } from "@/lib/utils";
import { toast } from "sonner";
import {
  BranchAssetForm,
  type BranchAssetFormHandle,
} from "@/components/admin/branch-asset-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

const PER_PAGE = 10;

type AssetDialogState =
  | { mode: "create" }
  | { mode: "edit"; asset: BranchAsset }
  | null;

function assetToFormValues(
  asset: BranchAsset,
): Partial<BranchAssetFormValues> {
  return {
    title: asset.title,
    description: asset.description ?? "",
    quantity: asset.quantity,
    price_amount: asset.price_amount,
    photo_url: asset.photo_url ?? "",
  };
}

function formatQuantity(quantity: number) {
  if (!Number.isFinite(quantity)) return "—";
  if (Number.isInteger(quantity)) return String(quantity);
  return quantity.toLocaleString("id-ID", { maximumFractionDigits: 4 });
}

function AssetPhotoThumbnail({ photoUrl }: { photoUrl?: string | null }) {
  return (
    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={menuPhotoUrl(photoUrl)}
        alt=""
        className="h-full w-full object-cover"
        onError={(event) => {
          event.currentTarget.src = menuPhotoUrl(null);
        }}
      />
    </div>
  );
}

export default function AdminBranchAssetsPage() {
  const [assets, setAssets] = useState<BranchAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BranchAsset | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dialog, setDialog] = useState<AssetDialogState>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<BranchAssetFormHandle>(null);

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
      const res = await branchAssetsAdminApi.list({
        page,
        perPage: PER_PAGE,
        search: debounced,
      });
      setAssets(res.data ?? []);
      setTotal(res.meta?.total ?? 0);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load branch assets",
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
      await branchAssetsAdminApi.delete(pendingDelete.id);
      toast.success("Branch asset deleted");
      setPendingDelete(null);
      void load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete branch asset",
      );
    } finally {
      setDeleting(false);
    }
  };

  const closeDialog = () => {
    if (saving) return;
    setDialog(null);
  };

  const handleFormSubmit = async (values: BranchAssetFormValues) => {
    if (!dialog) return;
    setSaving(true);
    try {
      const payload = branchAssetFormToPayload(values);
      if (dialog.mode === "create") {
        await branchAssetsAdminApi.create(payload);
        toast.success("Branch asset created");
      } else {
        await branchAssetsAdminApi.update(dialog.asset.id, payload);
        toast.success("Branch asset updated");
      }
      setDialog(null);
      void load();
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        formRef.current?.applyServerErrors(err.fields);
      }
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save branch asset",
      );
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const dialogTitle =
    dialog?.mode === "edit" ? "Edit branch asset" : "Add branch asset";

  const formDefaultValues =
    dialog?.mode === "edit" ? assetToFormValues(dialog.asset) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Branch Assets</h2>
          <p className="text-muted-foreground">{total} total</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by title"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => setDialog({ mode: "create" })}>
            <Plus className="h-4 w-4" />
            Add asset
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Photo</th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Quantity</th>
                <th className="px-4 py-3 font-medium">Unit price</th>
                <th className="px-4 py-3 font-medium">Line value</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-destructive"
                  >
                    {error}
                  </td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No branch assets found.
                  </td>
                </tr>
              ) : (
                assets.map((asset) => (
                  <tr
                    key={asset.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <AssetPhotoThumbnail photoUrl={asset.photo_url} />
                    </td>
                    <td className="px-4 py-3 font-medium">{asset.title}</td>
                    <td className="max-w-xs px-4 py-3 text-muted-foreground">
                      {displayDescription(asset.description)}
                    </td>
                    <td className="px-4 py-3">
                      {formatQuantity(asset.quantity)}
                    </td>
                    <td className="px-4 py-3">
                      {formatRupiah(asset.price_amount)}
                    </td>
                    <td className="px-4 py-3">
                      {formatRupiah(asset.line_value)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Edit branch asset"
                          onClick={() =>
                            setDialog({ mode: "edit", asset })
                          }
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          aria-label="Delete branch asset"
                          onClick={() => setPendingDelete(asset)}
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

      <Dialog open={dialog !== null} onClose={closeDialog} className="max-w-lg">
        <DialogTitle>{dialogTitle}</DialogTitle>
        {dialog && (
          <BranchAssetForm
            key={
              dialog.mode === "edit" ? `edit-${dialog.asset.id}` : "create"
            }
            ref={formRef}
            defaultValues={formDefaultValues}
            onSubmit={handleFormSubmit}
            onCancel={closeDialog}
            isLoading={saving}
            submitLabel={dialog.mode === "edit" ? "Save changes" : "Add asset"}
          />
        )}
      </Dialog>

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold">Delete branch asset</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {pendingDelete.title}
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

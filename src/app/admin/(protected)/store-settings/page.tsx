"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  getAdminStoreSettings,
  storeSettingsFormToPayload,
  updateAdminStoreSettings,
} from "@/lib/api/store-settings";
import { ApiError } from "@/lib/api/client";
import type { StoreSettings } from "@/lib/api/types";
import {
  storeSettingsSchema,
  type StoreSettingsFormValues,
} from "@/lib/validations";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

function settingsToFormValues(
  settings: StoreSettings,
): StoreSettingsFormValues {
  return {
    brand_name: settings.brand_name,
    branch_name: settings.branch_name,
    address: settings.address,
    phone: settings.phone,
    thank_you_note: settings.thank_you_note ?? "",
  };
}

function FormFieldSkeleton() {
  return (
    <div className="space-y-1.5">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export default function AdminStoreSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<StoreSettingsFormValues>({
    resolver: zodResolver(storeSettingsSchema),
    defaultValues: {
      brand_name: "",
      branch_name: "",
      address: "",
      phone: "",
      thank_you_note: "",
    },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await getAdminStoreSettings();
      if (result.data) {
        reset(settingsToFormValues(result.data));
      }
    } catch (err) {
      setLoadError(
        err instanceof ApiError
          ? err.message
          : "Failed to load receipt settings",
      );
    } finally {
      setLoading(false);
    }
  }, [reset]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSubmit = async (values: StoreSettingsFormValues) => {
    setSaving(true);
    try {
      const result = await updateAdminStoreSettings(
        storeSettingsFormToPayload(values),
      );
      if (result.data) {
        reset(settingsToFormValues(result.data));
      }
      toast.success("Receipt settings saved");
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        for (const [field, message] of Object.entries(err.fields)) {
          if (
            field === "brand_name" ||
            field === "branch_name" ||
            field === "address" ||
            field === "phone" ||
            field === "thank_you_note"
          ) {
            setError(field, { message });
          }
        }
      }
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to save receipt settings",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Receipt Settings</h2>
        <p className="text-muted-foreground">
          Configure the header and footer text printed on POS receipts.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Store receipt details</CardTitle>
          <CardDescription>
            These fields appear on printed receipts from the POS app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <FormFieldSkeleton />
              <FormFieldSkeleton />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-24 w-full" />
              </div>
              <FormFieldSkeleton />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-20 w-full" />
              </div>
            </div>
          ) : loadError ? (
            <div className="space-y-4">
              <p className="text-sm text-destructive">{loadError}</p>
              <Button variant="outline" onClick={() => void load()}>
                Retry
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="brand-name">Brand name (receipt header)</Label>
                <Input
                  id="brand-name"
                  autoComplete="organization"
                  maxLength={200}
                  {...register("brand_name")}
                />
                {errors.brand_name && (
                  <p className="text-sm text-destructive">
                    {errors.brand_name.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="branch-name">Branch name (receipt header)</Label>
                <Input
                  id="branch-name"
                  autoComplete="off"
                  maxLength={200}
                  {...register("branch_name")}
                />
                {errors.branch_name && (
                  <p className="text-sm text-destructive">
                    {errors.branch_name.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address">Address (receipt header)</Label>
                <Textarea
                  id="address"
                  rows={3}
                  maxLength={500}
                  {...register("address")}
                />
                {errors.address && (
                  <p className="text-sm text-destructive">
                    {errors.address.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone (receipt header)</Label>
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  maxLength={30}
                  {...register("phone")}
                />
                {errors.phone && (
                  <p className="text-sm text-destructive">
                    {errors.phone.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="thank-you-note">
                  Thank you note (receipt footer)
                </Label>
                <Textarea
                  id="thank-you-note"
                  rows={3}
                  maxLength={500}
                  placeholder="e.g. Thank you for your visit!"
                  {...register("thank_you_note")}
                />
                {errors.thank_you_note && (
                  <p className="text-sm text-destructive">
                    {errors.thank_you_note.message}
                  </p>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" isLoading={saving}>
                  Save
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

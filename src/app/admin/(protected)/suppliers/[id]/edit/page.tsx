"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  suppliersAdminApi,
  supplierFormToPayload,
} from "@/lib/api/suppliers";
import { ApiError } from "@/lib/api/client";
import type { Supplier } from "@/lib/api/types";
import type { SupplierFormValues } from "@/lib/validations";
import { toast } from "sonner";
import {
  SupplierForm,
  type SupplierFormHandle,
} from "@/components/admin/supplier-form";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function supplierToFormValues(
  supplier: Supplier,
): Partial<SupplierFormValues> {
  return {
    name: supplier.name,
    phone_number: supplier.phone_number,
    address: supplier.address,
    supports_delivery: supplier.supports_delivery,
    delivery_cost: supplier.delivery_cost ?? undefined,
  };
}

export default function AdminEditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const formRef = useRef<SupplierFormHandle>(null);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    suppliersAdminApi
      .get(id)
      .then((res) => setSupplier(res.data))
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : "Failed to load supplier",
        ),
      )
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (values: SupplierFormValues) => {
    setSaving(true);
    try {
      await suppliersAdminApi.update(id, supplierFormToPayload(values));
      toast.success("Supplier updated");
      router.push(`/admin/suppliers/${id}`);
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        formRef.current?.applyServerErrors(err.fields);
      }
      toast.error(
        err instanceof ApiError ? err.message : "Failed to update supplier",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href={`/admin/suppliers/${id}`}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to supplier
      </Link>

      {loading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : supplier ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit supplier</CardTitle>
          </CardHeader>
          <CardContent>
            <SupplierForm
              key={supplier.id}
              ref={formRef}
              defaultValues={supplierToFormValues(supplier)}
              onSubmit={handleSubmit}
              onCancel={() => router.push(`/admin/suppliers/${id}`)}
              isLoading={saving}
              submitLabel="Save changes"
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

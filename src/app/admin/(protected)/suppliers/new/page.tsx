"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  suppliersAdminApi,
  supplierFormToPayload,
} from "@/lib/api/suppliers";
import { ApiError } from "@/lib/api/client";
import type { SupplierFormValues } from "@/lib/validations";
import { toast } from "sonner";
import {
  SupplierForm,
  type SupplierFormHandle,
} from "@/components/admin/supplier-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminNewSupplierPage() {
  const router = useRouter();
  const formRef = useRef<SupplierFormHandle>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (values: SupplierFormValues) => {
    setSaving(true);
    try {
      const result = await suppliersAdminApi.create(
        supplierFormToPayload(values),
      );
      toast.success("Supplier created");
      router.push(`/admin/suppliers/${result.data.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        formRef.current?.applyServerErrors(err.fields);
      }
      toast.error(
        err instanceof ApiError ? err.message : "Failed to create supplier",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href="/admin/suppliers"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to suppliers
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>New supplier</CardTitle>
        </CardHeader>
        <CardContent>
          <SupplierForm
            ref={formRef}
            onSubmit={handleSubmit}
            onCancel={() => router.push("/admin/suppliers")}
            isLoading={saving}
            submitLabel="Create supplier"
          />
        </CardContent>
      </Card>
    </div>
  );
}

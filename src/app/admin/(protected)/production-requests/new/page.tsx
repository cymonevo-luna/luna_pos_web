"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  productionRequestsAdminApi,
  productionRequestFormToPayload,
} from "@/lib/api/production-requests";
import { ApiError } from "@/lib/api/client";
import type { ProductionRequestFormValues } from "@/lib/validations";
import { toast } from "sonner";
import {
  ProductionRequestForm,
  type ProductionRequestFormHandle,
} from "@/components/admin/production-request-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminNewProductionRequestPage() {
  const router = useRouter();
  const formRef = useRef<ProductionRequestFormHandle>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (values: ProductionRequestFormValues) => {
    setSaving(true);
    try {
      const result = await productionRequestsAdminApi.create(
        productionRequestFormToPayload(values),
      );
      toast.success("Production request created");
      router.push(`/admin/production-requests/${result.data.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        formRef.current?.applyServerErrors(err.fields);
      }
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to create production request",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/admin/production-requests"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to production requests
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>New production request</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductionRequestForm
            ref={formRef}
            onSubmit={handleSubmit}
            onCancel={() => router.push("/admin/production-requests")}
            isLoading={saving}
            submitLabel="Create production request"
          />
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  purchaseRequestsAdminApi,
  purchaseRequestFormToPayload,
} from "@/lib/api/purchase-requests";
import { ApiError } from "@/lib/api/client";
import type { PurchaseRequestFormValues } from "@/lib/validations";
import { toast } from "sonner";
import {
  PurchaseRequestForm,
  type PurchaseRequestFormHandle,
} from "@/components/admin/purchase-request-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminNewPurchasePage() {
  const router = useRouter();
  const formRef = useRef<PurchaseRequestFormHandle>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (values: PurchaseRequestFormValues) => {
    setSaving(true);
    try {
      const result = await purchaseRequestsAdminApi.create(
        purchaseRequestFormToPayload(values),
      );
      toast.success("Purchase request created");
      router.push(`/admin/purchases/${result.data.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        formRef.current?.applyServerErrors(err.fields);
      }
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to create purchase request",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/admin/purchases"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to purchases
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>New purchase request</CardTitle>
        </CardHeader>
        <CardContent>
          <PurchaseRequestForm
            ref={formRef}
            onSubmit={handleSubmit}
            onCancel={() => router.push("/admin/purchases")}
            isLoading={saving}
            submitLabel="Create purchase request"
          />
        </CardContent>
      </Card>
    </div>
  );
}

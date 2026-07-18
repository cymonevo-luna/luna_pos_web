"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { SmartPurchaseRequestWizard } from "@/components/admin/smart-purchase-request-wizard";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminSmartPurchasePage() {
  const router = useRouter();

  const handleSuccess = () => {
    toast.success("Purchase requests created");
    router.push("/admin/purchases");
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
          <CardTitle>Smart Request</CardTitle>
        </CardHeader>
        <CardContent>
          <SmartPurchaseRequestWizard
            onCancel={() => router.push("/admin/purchases")}
            onSuccess={handleSuccess}
          />
        </CardContent>
      </Card>
    </div>
  );
}

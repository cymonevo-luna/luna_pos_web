"use client";

import { use } from "react";
import { ProductionRequestDetailContent } from "@/components/admin/production-request-detail-content";

export default function AdminProductionRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ProductionRequestDetailContent id={id} />;
}

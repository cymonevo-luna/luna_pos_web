"use client";

import { use } from "react";
import { ProductionRequestDetailContent } from "./production-request-detail-content";

export default function AdminProductionRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ProductionRequestDetailContent id={id} />;
}

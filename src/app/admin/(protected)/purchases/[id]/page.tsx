"use client";

import { use } from "react";
import { AdminPurchaseDetailContent } from "./purchase-detail-content";

export default function AdminPurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <AdminPurchaseDetailContent id={id} />;
}

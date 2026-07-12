"use client";

import { use } from "react";
import { AdminSupplierDetailContent } from "./supplier-detail-content";

export default function AdminSupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <AdminSupplierDetailContent id={id} />;
}

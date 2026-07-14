"use client";

import { use } from "react";
import { AdminTransactionDetailContent } from "./transaction-detail-content";

export default function AdminTransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <AdminTransactionDetailContent id={id} />;
}

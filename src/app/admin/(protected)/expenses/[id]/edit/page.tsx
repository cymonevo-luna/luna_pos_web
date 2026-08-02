"use client";

import { use } from "react";
import { AdminEditExpenseContent } from "./expense-edit-content";

export default function AdminEditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <AdminEditExpenseContent id={id} />;
}

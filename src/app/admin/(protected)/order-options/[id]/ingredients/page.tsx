"use client";

import { use } from "react";
import { AdminOrderOptionIngredientsContent } from "./order-option-ingredients-content";

export default function AdminOrderOptionIngredientsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <AdminOrderOptionIngredientsContent id={id} />;
}

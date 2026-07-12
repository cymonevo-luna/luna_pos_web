"use client";

import { use } from "react";
import { AdminMenuIngredientsContent } from "./menu-ingredients-content";

export default function AdminMenuIngredientsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <AdminMenuIngredientsContent id={id} />;
}

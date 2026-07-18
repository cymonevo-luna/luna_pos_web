import { redirect } from "next/navigation";

export default function AdminCogsRedirectPage() {
  redirect("/admin/cogs/menu-breakdown");
}

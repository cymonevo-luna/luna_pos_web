import type { MerchantRole } from "@/lib/api/types";
import { formatRoleLabel, resolveUserRoles } from "@/lib/auth/roles";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function roleBadgeVariant(role: MerchantRole) {
  switch (role) {
    case "admin":
      return "success" as const;
    case "manager":
      return "default" as const;
    case "operational":
      return "warning" as const;
    default:
      return "secondary" as const;
  }
}

export function UserRoleBadges({
  roles,
  className,
}: {
  roles: MerchantRole[] | Pick<{ roles: MerchantRole[] }, "roles">;
  className?: string;
}) {
  const resolved = Array.isArray(roles) ? roles : resolveUserRoles(roles);

  if (resolved.length === 0) {
    return <span className="text-muted-foreground text-sm">No roles</span>;
  }

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {resolved.map((role) => (
        <Badge key={role} variant={roleBadgeVariant(role)}>
          {formatRoleLabel(role)}
        </Badge>
      ))}
    </div>
  );
}

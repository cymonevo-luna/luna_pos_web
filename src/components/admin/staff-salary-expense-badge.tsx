import { STAFF_SALARY_EXPENSE_TOOLTIP } from "@/lib/api/expenses";
import { Badge } from "@/components/ui/badge";

export function StaffSalaryExpenseBadge() {
  return (
    <Badge
      variant="outline"
      title={STAFF_SALARY_EXPENSE_TOOLTIP}
      data-testid="staff-salary-expense-badge"
    >
      Staff salary
    </Badge>
  );
}

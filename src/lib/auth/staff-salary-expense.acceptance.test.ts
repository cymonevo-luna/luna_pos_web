import { describe, it, expect } from "vitest";
import { isStaffSalaryExpense } from "@/lib/api/expenses";
import { canAccessRoute } from "@/lib/auth/roles";
import {
  featuresForRoles,
  sourceWithFeatures,
} from "@/lib/auth/feature-fixtures";

/**
 * Checklist coverage for POS-181-5 acceptance criteria.
 */
describe("POS-181-5 staff salary expense editing", () => {
  it("1. Manager can access expense edit for salary expenses", () => {
    const manager = sourceWithFeatures(["manager"]);
    expect(canAccessRoute("/admin/expenses", manager)).toBe(true);
    expect(canAccessRoute("/admin/expenses/exp-salary-1/edit", manager)).toBe(
      true,
    );
  });

  it("2. User with records.edit_date can access expense edit", () => {
    const managerWithDateEdit = sourceWithFeatures(
      ["manager"],
      [...featuresForRoles(["manager"]), "records.edit_date"],
    );
    expect(
      canAccessRoute("/admin/expenses/exp-salary-1/edit", managerWithDateEdit),
    ).toBe(true);
  });

  it("3. Salary expenses are identifiable via recurring link and staff id", () => {
    expect(
      isStaffSalaryExpense({
        recurring_expense_id: "recurring-expense-1",
        recurring_expense_staff_id: "staff-1",
      }),
    ).toBe(true);
  });

  it("4. Manual expenses are not flagged as staff salary", () => {
    expect(
      isStaffSalaryExpense({
        recurring_expense_id: null,
        recurring_expense_staff_id: null,
      }),
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { todayWIB } from "@/lib/datetime/wib";
import { expenseCreateSchema } from "@/lib/validations";

const validFields = {
  title: "Office supplies",
  description: "",
  amount: 150_000,
  source_of_fund: "PERSONAL_MONEY" as const,
  receipt_url: "",
};

describe("expenseCreateSchema", () => {
  it("rejects future transaction date", () => {
    const result = expenseCreateSchema.safeParse({
      ...validFields,
      transactionDate: "2099-01-01",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.message.includes("Transaction date cannot be in the future"),
        ),
      ).toBe(true);
    }
  });

  it("accepts today WIB transaction date", () => {
    const result = expenseCreateSchema.safeParse({
      ...validFields,
      transactionDate: todayWIB(),
    });

    expect(result.success).toBe(true);
  });

  it("accepts past transaction date", () => {
    const result = expenseCreateSchema.safeParse({
      ...validFields,
      transactionDate: "2026-01-15",
    });

    expect(result.success).toBe(true);
  });
});

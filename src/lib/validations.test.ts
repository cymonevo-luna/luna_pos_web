import { describe, expect, it } from "vitest";
import { todayWIB } from "@/lib/datetime/wib";
import { expenseCreateSchema, expenseSourceOfFundSchema } from "@/lib/validations";

const validFields = {
  title: "Office supplies",
  description: "",
  amount: 150_000,
  source_of_fund: "PERSONAL_MONEY" as const,
  receipt_url: "",
};

describe("expenseSourceOfFundSchema", () => {
  it("accepts CASHIER, QRIS, and PERSONAL_MONEY", () => {
    expect(expenseSourceOfFundSchema.safeParse("CASHIER").success).toBe(true);
    expect(expenseSourceOfFundSchema.safeParse("QRIS").success).toBe(true);
    expect(expenseSourceOfFundSchema.safeParse("PERSONAL_MONEY").success).toBe(
      true,
    );
  });

  it("rejects unknown source values", () => {
    expect(expenseSourceOfFundSchema.safeParse("BANK").success).toBe(false);
  });
});

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

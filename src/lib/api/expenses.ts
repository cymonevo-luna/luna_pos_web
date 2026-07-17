import { api, type ApiResult } from "./client";
import { parseNumeric } from "./suppliers";
import type { Expense } from "./types";
import type { ExpenseFormValues } from "@/lib/validations";

/** Wire format from the Go backend (`decimal.Decimal` marshals as JSON string). */
interface ExpenseRaw extends Omit<Expense, "amount"> {
  amount: number | string;
}

export function normalizeExpense(raw: ExpenseRaw): Expense {
  return {
    ...raw,
    amount: parseNumeric(raw.amount),
  };
}

function normalizeListResult(
  result: ApiResult<ExpenseRaw[]>,
): ApiResult<Expense[]> {
  return {
    ...result,
    data: result.data.map(normalizeExpense),
  };
}

function normalizeItemResult(
  result: ApiResult<ExpenseRaw>,
): ApiResult<Expense> {
  return {
    ...result,
    data: normalizeExpense(result.data),
  };
}

export interface ListExpensesParams {
  page?: number;
  perPage?: number;
  search?: string;
}

export interface CreateExpensePayload {
  title: string;
  description?: string | null;
  amount: number;
  receipt_url?: string;
}

export type UpdateExpensePayload = CreateExpensePayload;

/** Map form values to an API payload. */
export function expenseFormToPayload(
  values: ExpenseFormValues,
  options?: { includeEmptyReceipt?: boolean },
): CreateExpensePayload {
  const payload: CreateExpensePayload = {
    title: values.title.trim(),
    amount: values.amount,
  };

  const description = values.description?.trim();
  if (description) {
    payload.description = description;
  }

  const receiptUrl = values.receipt_url?.trim() ?? "";
  if (receiptUrl) {
    payload.receipt_url = receiptUrl;
  } else if (options?.includeEmptyReceipt) {
    payload.receipt_url = "";
  }

  return payload;
}

export function expenseToFormValues(
  expense: Expense,
): Partial<ExpenseFormValues> {
  return {
    title: expense.title,
    description: expense.description ?? "",
    amount: expense.amount,
    receipt_url: expense.receipt_url ?? "",
  };
}

export async function listExpenses({
  page = 1,
  perPage = 10,
  search = "",
}: ListExpensesParams = {}) {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  if (search) params.set("search", search);
  const result = await api.get<ExpenseRaw[]>(
    `/api/admin/expenses?${params.toString()}`,
  );
  return normalizeListResult(result);
}

export async function getExpense(id: string) {
  const result = await api.get<ExpenseRaw>(`/api/admin/expenses/${id}`);
  return normalizeItemResult(result);
}

export async function createExpense(payload: CreateExpensePayload) {
  const result = await api.post<ExpenseRaw>("/api/admin/expenses", payload);
  return normalizeItemResult(result);
}

export async function updateExpense(id: string, payload: UpdateExpensePayload) {
  const result = await api.put<ExpenseRaw>(
    `/api/admin/expenses/${id}`,
    payload,
  );
  return normalizeItemResult(result);
}

export async function deleteExpense(id: string) {
  return api.delete<void>(`/api/admin/expenses/${id}`);
}

export { uploadExpenseReceipt } from "./uploads";

export const expensesAdminApi = {
  list: listExpenses,
  get: getExpense,
  create: createExpense,
  update: updateExpense,
  delete: deleteExpense,
};

import { api, type ApiResult } from "./client";
import { parseNumeric } from "./suppliers";
import type { Expense } from "./types";

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

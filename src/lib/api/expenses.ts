import { config } from "@/lib/config";
import {
  clearSessionAndRedirectToLogin,
  ensureFreshAccessToken,
  isLoginRoute,
  performSessionRefresh,
} from "@/lib/auth/session-refresh";
import { tokenStore } from "@/lib/auth/tokens";
import { startOfDayWIB, todayWIB } from "@/lib/datetime/wib";
import { api, ApiError, type ApiResult } from "./client";
import { parseNumeric } from "./suppliers";
import { appendHistoryDateParams } from "./history-date-params";
import type { Envelope, Expense, ExpenseSourceOfFund } from "./types";
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
  dateFrom?: string;
  dateTo?: string;
}

export interface CreateExpensePayload {
  title: string;
  description?: string | null;
  amount: number;
  source_of_fund: ExpenseSourceOfFund;
  receipt_url?: string;
  transaction_date?: string;
}

export type UpdateExpensePayload = CreateExpensePayload;

/**
 * Map form values to an API payload.
 *
 * Server validation errors on `transaction_date` are mapped to the form field
 * `transactionDate` in `ExpenseForm.applyServerErrors` (expense-form.tsx).
 */
export function expenseFormToPayload(
  values: ExpenseFormValues & { transactionDate?: string },
  options?: { includeEmptyReceipt?: boolean; includeTransactionDate?: boolean },
): CreateExpensePayload {
  const payload: CreateExpensePayload = {
    title: values.title.trim(),
    amount: values.amount,
    source_of_fund: values.source_of_fund,
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

  if (
    options?.includeTransactionDate &&
    values.transactionDate &&
    values.transactionDate !== todayWIB()
  ) {
    payload.transaction_date = startOfDayWIB(values.transactionDate).toISOString();
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
    source_of_fund: expense.source_of_fund ?? "PERSONAL_MONEY",
    receipt_url: expense.receipt_url ?? "",
    recordDate: new Date(expense.transaction_date),
  };
}

export async function listExpenses({
  page = 1,
  perPage = 10,
  search = "",
  dateFrom = "",
  dateTo = "",
}: ListExpensesParams = {}) {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  if (search) params.set("search", search);
  appendHistoryDateParams(params, dateFrom, dateTo);
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

export async function updateRecordDate(id: string, recordDate: Date) {
  const result = await api.patch<ExpenseRaw>(
    `/api/admin/expenses/${id}/record-date`,
    { record_date: recordDate.toISOString() },
  );
  return normalizeItemResult(result);
}

export async function deleteExpense(id: string) {
  return api.delete<void>(`/api/admin/expenses/${id}`);
}

export interface ImportExpensesCsvParams {
  file: File;
  transactionDate: string;
}

interface ImportExpensesCsvResultRaw {
  imported_row_count: number;
  expenses?: ExpenseRaw[];
}

export interface ImportExpensesCsvResult {
  imported_row_count: number;
  expenses?: Expense[];
}

/** Download the expense import CSV template. */
export async function downloadExpenseImportTemplate() {
  return api.downloadBlobResult("/api/admin/expenses/import/template");
}

/** Trigger a browser download for the expense import template blob. */
export function downloadExpenseImportTemplateFile(
  blob: Blob,
  options: { filename?: string } = {},
) {
  const { filename } = options;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename ?? "expense-import-template.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

async function importExpensesCsvRequest(
  params: ImportExpensesCsvParams,
  _retried = false,
): Promise<ImportExpensesCsvResult> {
  if (!isLoginRoute() && (tokenStore.access || tokenStore.refresh)) {
    const fresh = await ensureFreshAccessToken();
    if (!fresh) {
      clearSessionAndRedirectToLogin();
      throw new ApiError(401, "unauthorized", "Session expired");
    }
  }

  const formData = new FormData();
  formData.append("file", params.file);
  formData.append("transaction_date", params.transactionDate);

  const headers = new Headers();
  if (!isLoginRoute()) {
    const token = tokenStore.access;
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${config.apiBaseUrl}/api/admin/expenses/import`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (res.status === 401 && !_retried && !isLoginRoute()) {
    const refreshed = await performSessionRefresh();
    if (refreshed) {
      return importExpensesCsvRequest(params, true);
    }
    clearSessionAndRedirectToLogin();
  }

  let json: Envelope<ImportExpensesCsvResultRaw>;
  try {
    json = (await res.json()) as Envelope<ImportExpensesCsvResultRaw>;
  } catch {
    throw new ApiError(res.status, "invalid_response", res.statusText);
  }

  if (!res.ok || json.success === false) {
    const err = json.error;
    throw new ApiError(
      res.status,
      err?.code ?? "error",
      err?.message ?? "Import failed",
      err?.fields,
      json.data,
    );
  }

  const data = json.data as ImportExpensesCsvResultRaw;
  return {
    imported_row_count: data.imported_row_count,
    expenses: data.expenses?.map(normalizeExpense),
  };
}

/** Import expenses from a CSV file. */
export async function importExpensesCsv(
  params: ImportExpensesCsvParams,
): Promise<ImportExpensesCsvResult> {
  return importExpensesCsvRequest(params);
}

export { uploadExpenseReceipt } from "./uploads";

export const expensesAdminApi = {
  list: listExpenses,
  get: getExpense,
  create: createExpense,
  update: updateExpense,
  updateRecordDate,
  delete: deleteExpense,
  downloadImportTemplate: downloadExpenseImportTemplate,
  downloadImportTemplateFile: downloadExpenseImportTemplateFile,
  importCsv: importExpensesCsv,
};

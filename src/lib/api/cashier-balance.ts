import { api, type ApiResult } from "./client";
import { parseNumeric } from "./suppliers";
import type {
  CashierBalance,
  CashierBalanceAdjustmentType,
  CashierBalanceEntry,
  CashierBalanceEntrySource,
} from "./types";
import type { CashierBalanceAdjustmentFormValues } from "@/lib/validations";

/** Wire format from the Go backend (`decimal.Decimal` / int64 may marshal as string). */
interface CashierBalanceRaw extends Omit<CashierBalance, "balance"> {
  balance: number | string;
}

interface CashierBalanceEntryRaw extends Omit<CashierBalanceEntry, "amount"> {
  amount: number | string;
}

export function normalizeCashierBalance(raw: CashierBalanceRaw): CashierBalance {
  return {
    ...raw,
    balance: parseNumeric(raw.balance),
  };
}

export function normalizeCashierBalanceEntry(
  raw: CashierBalanceEntryRaw,
): CashierBalanceEntry {
  return {
    ...raw,
    amount: parseNumeric(raw.amount),
  };
}

function normalizeBalanceResult(
  result: ApiResult<CashierBalanceRaw>,
): ApiResult<CashierBalance> {
  return {
    ...result,
    data: normalizeCashierBalance(result.data),
  };
}

function normalizeEntriesListResult(
  result: ApiResult<CashierBalanceEntryRaw[]>,
): ApiResult<CashierBalanceEntry[]> {
  return {
    ...result,
    data: result.data.map(normalizeCashierBalanceEntry),
  };
}

export interface ListCashierBalanceEntriesParams {
  page?: number;
  perPage?: number;
}

export interface CreateCashierBalanceAdjustmentPayload {
  type: CashierBalanceAdjustmentType;
  amount: number;
  purpose: string;
}

export function cashierBalanceAdjustmentFormToPayload(
  values: CashierBalanceAdjustmentFormValues,
): CreateCashierBalanceAdjustmentPayload {
  return {
    type: values.type,
    amount: values.amount,
    purpose: values.purpose.trim(),
  };
}

const DELETABLE_ENTRY_SOURCES = new Set<CashierBalanceEntrySource>([
  "MANUAL",
  "EXPENSE",
]);

export function isCashierBalanceEntryDeletable(
  entry: Pick<CashierBalanceEntry, "source">,
): boolean {
  return DELETABLE_ENTRY_SOURCES.has(entry.source);
}

export function isCashierBalanceEntryDateEditable(
  entry: Pick<CashierBalanceEntry, "transaction_id" | "expense_id">,
): boolean {
  return !entry.transaction_id && !entry.expense_id;
}

export async function getBalance() {
  const result = await api.get<CashierBalanceRaw>("/api/admin/cashier-balance");
  return normalizeBalanceResult(result);
}

export async function listEntries({
  page = 1,
  perPage = 10,
}: ListCashierBalanceEntriesParams = {}) {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  const result = await api.get<CashierBalanceEntryRaw[]>(
    `/api/admin/cashier-balance/entries?${params.toString()}`,
  );
  return normalizeEntriesListResult(result);
}

export async function createAdjustment(
  payload: CreateCashierBalanceAdjustmentPayload,
) {
  const result = await api.post<CashierBalanceEntryRaw>(
    "/api/admin/cashier-balance/adjustments",
    payload,
  );
  return {
    ...result,
    data: normalizeCashierBalanceEntry(result.data),
  };
}

export async function deleteEntry(id: string) {
  const result = await api.delete<CashierBalanceRaw>(
    `/api/admin/cashier-balance/entries/${id}`,
  );
  return normalizeBalanceResult(result);
}

export async function updateEntryRecordDate(entryId: string, recordDate: Date) {
  const result = await api.patch<CashierBalanceEntryRaw>(
    `/api/admin/cashier-balance/entries/${entryId}/record-date`,
    { record_date: recordDate.toISOString() },
  );
  return {
    ...result,
    data: normalizeCashierBalanceEntry(result.data),
  };
}

export const cashierBalanceAdminApi = {
  getBalance,
  listEntries,
  createAdjustment,
  deleteEntry,
  updateEntryRecordDate,
};

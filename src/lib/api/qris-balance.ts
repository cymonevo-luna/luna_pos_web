import { api, type ApiResult } from "./client";
import { parseNumeric } from "./suppliers";
import type {
  QrisBalance,
  QrisBalanceAdjustmentType,
  QrisBalanceEntry,
  QrisBalanceEntrySource,
} from "./types";
import type { QrisBalanceAdjustmentFormValues } from "@/lib/validations";

/** Wire format from the Go backend (`decimal.Decimal` / int64 may marshal as string). */
interface QrisBalanceRaw extends Omit<QrisBalance, "balance"> {
  balance: number | string;
}

interface QrisBalanceEntryRaw extends Omit<QrisBalanceEntry, "amount"> {
  amount: number | string;
}

export function normalizeQrisBalance(raw: QrisBalanceRaw): QrisBalance {
  return {
    ...raw,
    balance: parseNumeric(raw.balance),
  };
}

export function normalizeQrisBalanceEntry(
  raw: QrisBalanceEntryRaw,
): QrisBalanceEntry {
  return {
    ...raw,
    amount: parseNumeric(raw.amount),
  };
}

function normalizeBalanceResult(
  result: ApiResult<QrisBalanceRaw>,
): ApiResult<QrisBalance> {
  return {
    ...result,
    data: normalizeQrisBalance(result.data),
  };
}

function normalizeEntriesListResult(
  result: ApiResult<QrisBalanceEntryRaw[]>,
): ApiResult<QrisBalanceEntry[]> {
  return {
    ...result,
    data: result.data.map(normalizeQrisBalanceEntry),
  };
}

export interface ListQrisBalanceEntriesParams {
  page?: number;
  perPage?: number;
}

export interface CreateQrisBalanceAdjustmentPayload {
  type: QrisBalanceAdjustmentType;
  amount: number;
  purpose: string;
}

export function qrisBalanceAdjustmentFormToPayload(
  values: QrisBalanceAdjustmentFormValues,
): CreateQrisBalanceAdjustmentPayload {
  return {
    type: values.type,
    amount: values.amount,
    purpose: values.purpose.trim(),
  };
}

const DELETABLE_ENTRY_SOURCES = new Set<QrisBalanceEntrySource>([
  "MANUAL",
  "EXPENSE",
]);

export function isQrisBalanceEntryDeletable(
  entry: Pick<QrisBalanceEntry, "source">,
): boolean {
  return DELETABLE_ENTRY_SOURCES.has(entry.source);
}

export function isQrisBalanceEntryDateEditable(
  entry: Pick<QrisBalanceEntry, "transaction_id" | "expense_id">,
): boolean {
  return !entry.transaction_id && !entry.expense_id;
}

export async function getBalance() {
  const result = await api.get<QrisBalanceRaw>("/api/admin/qris-balance");
  return normalizeBalanceResult(result);
}

export async function listEntries({
  page = 1,
  perPage = 10,
}: ListQrisBalanceEntriesParams = {}) {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  const result = await api.get<QrisBalanceEntryRaw[]>(
    `/api/admin/qris-balance/entries?${params.toString()}`,
  );
  return normalizeEntriesListResult(result);
}

export async function createAdjustment(
  payload: CreateQrisBalanceAdjustmentPayload,
) {
  const result = await api.post<QrisBalanceEntryRaw>(
    "/api/admin/qris-balance/adjustments",
    payload,
  );
  return {
    ...result,
    data: normalizeQrisBalanceEntry(result.data),
  };
}

export async function deleteEntry(id: string) {
  const result = await api.delete<QrisBalanceRaw>(
    `/api/admin/qris-balance/entries/${id}`,
  );
  return normalizeBalanceResult(result);
}

export async function updateEntryRecordDate(entryId: string, recordDate: Date) {
  const result = await api.patch<QrisBalanceEntryRaw>(
    `/api/admin/qris-balance/entries/${entryId}/record-date`,
    { record_date: recordDate.toISOString() },
  );
  return {
    ...result,
    data: normalizeQrisBalanceEntry(result.data),
  };
}

export const qrisBalanceAdminApi = {
  getBalance,
  listEntries,
  createAdjustment,
  deleteEntry,
  updateEntryRecordDate,
};

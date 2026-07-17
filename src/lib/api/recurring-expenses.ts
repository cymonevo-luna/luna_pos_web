import { api, type ApiResult } from "./client";
import { parseNumeric } from "./suppliers";
import type {
  RecurringExpense,
  RecurringExpenseInterval,
  RecurringExpenseSchedule,
} from "./types";
import type { RecurringExpenseFormValues } from "@/lib/validations";

/** Wire format from the Go backend (`decimal.Decimal` marshals as JSON string). */
interface RecurringExpenseRaw
  extends Omit<RecurringExpense, "amount"> {
  amount: number | string;
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function normalizeRecurringExpense(
  raw: RecurringExpenseRaw,
): RecurringExpense {
  return {
    ...raw,
    amount: parseNumeric(raw.amount),
    staff_id: raw.staff_id ?? null,
  };
}

export function isStaffManagedRecurringExpense(
  expense: Pick<RecurringExpense, "staff_id">,
): boolean {
  return expense.staff_id != null && expense.staff_id !== "";
}

export const STAFF_MANAGED_RECURRING_EXPENSE_MESSAGE =
  "This recurring expense is managed via Staff salary and cannot be edited or deleted here.";

export const STAFF_MANAGED_RECURRING_EXPENSE_TOOLTIP =
  "Managed via Staff salary; view only. Salary is configured on the staff record (admin only).";

function normalizeListResult(
  result: ApiResult<RecurringExpenseRaw[]>,
): ApiResult<RecurringExpense[]> {
  return {
    ...result,
    data: result.data.map(normalizeRecurringExpense),
  };
}

function normalizeItemResult(
  result: ApiResult<RecurringExpenseRaw>,
): ApiResult<RecurringExpense> {
  return {
    ...result,
    data: normalizeRecurringExpense(result.data),
  };
}

export interface ListRecurringExpensesParams {
  page?: number;
  perPage?: number;
  search?: string;
  isActive?: boolean;
}

export interface RecurringExpenseSchedulePayload {
  interval: RecurringExpenseInterval;
  value?: number;
  time: {
    hour: number;
    minute: number;
    second: number;
  };
}

export interface CreateRecurringExpensePayload {
  title: string;
  description?: string | null;
  amount: number;
  is_active: boolean;
  recurring: RecurringExpenseSchedulePayload;
}

export type UpdateRecurringExpensePayload = CreateRecurringExpensePayload;

export function formatRecurringScheduleSummary(
  recurring: RecurringExpenseSchedule,
): string {
  const timeStr = [
    recurring.time.hour,
    recurring.time.minute,
    recurring.time.second,
  ]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");

  if (recurring.interval === "DAILY") {
    return `Every day at ${timeStr}`;
  }

  if (recurring.interval === "DAY" && recurring.value != null) {
    const dayLabel =
      WEEKDAY_LABELS[recurring.value - 1] ?? `Day ${recurring.value}`;
    return `Every ${dayLabel} at ${timeStr}`;
  }

  if (recurring.interval === "DATE" && recurring.value != null) {
    return `Day ${recurring.value} of month at ${timeStr}`;
  }

  return timeStr;
}

/** Map form values to an API payload. */
export function recurringExpenseFormToPayload(
  values: RecurringExpenseFormValues,
): CreateRecurringExpensePayload {
  const payload: CreateRecurringExpensePayload = {
    title: values.title.trim(),
    amount: values.amount,
    is_active: values.is_active,
    recurring: {
      interval: values.recurring.interval,
      time: {
        hour: values.recurring.time.hour,
        minute: values.recurring.time.minute,
        second: values.recurring.time.second,
      },
    },
  };

  if (values.recurring.interval !== "DAILY" && values.recurring.value != null) {
    payload.recurring.value = values.recurring.value;
  }

  const description = values.description?.trim();
  if (description) {
    payload.description = description;
  }

  return payload;
}

export async function listRecurringExpenses({
  page = 1,
  perPage = 10,
  search = "",
  isActive,
}: ListRecurringExpensesParams = {}) {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  if (search) params.set("search", search);
  if (isActive != null) params.set("is_active", String(isActive));

  const result = await api.get<RecurringExpenseRaw[]>(
    `/api/admin/recurring-expenses?${params.toString()}`,
  );
  return normalizeListResult(result);
}

export async function getRecurringExpense(id: string) {
  const result = await api.get<RecurringExpenseRaw>(
    `/api/admin/recurring-expenses/${id}`,
  );
  return normalizeItemResult(result);
}

export async function createRecurringExpense(
  payload: CreateRecurringExpensePayload,
) {
  const result = await api.post<RecurringExpenseRaw>(
    "/api/admin/recurring-expenses",
    payload,
  );
  return normalizeItemResult(result);
}

export async function updateRecurringExpense(
  id: string,
  payload: UpdateRecurringExpensePayload,
) {
  const result = await api.put<RecurringExpenseRaw>(
    `/api/admin/recurring-expenses/${id}`,
    payload,
  );
  return normalizeItemResult(result);
}

export async function deleteRecurringExpense(id: string) {
  return api.delete<void>(`/api/admin/recurring-expenses/${id}`);
}

export const recurringExpensesAdminApi = {
  list: listRecurringExpenses,
  get: getRecurringExpense,
  create: createRecurringExpense,
  update: updateRecurringExpense,
  delete: deleteRecurringExpense,
};

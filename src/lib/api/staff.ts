import { api, type ApiResult } from "./client";
import { parseNumeric } from "./suppliers";
import type { Staff } from "./types";
import type { StaffFormValues } from "@/lib/validations";

/** Wire format from the Go backend (`decimal.Decimal` marshals as JSON string). */
interface StaffRaw extends Omit<Staff, "salary_amount"> {
  salary_amount: number | string;
}

export function normalizeStaff(raw: StaffRaw): Staff {
  const payoutDay = raw.payout_day_of_month;
  return {
    ...raw,
    salary_amount: parseNumeric(raw.salary_amount),
    join_date: raw.join_date ?? null,
    payout_day_of_month:
      payoutDay === undefined || payoutDay === null
        ? null
        : Number(payoutDay),
    recurring_expense_id: raw.recurring_expense_id ?? null,
  };
}

function normalizeListResult(
  result: ApiResult<StaffRaw[]>,
): ApiResult<Staff[]> {
  return {
    ...result,
    data: result.data.map(normalizeStaff),
  };
}

function normalizeItemResult(
  result: ApiResult<StaffRaw>,
): ApiResult<Staff> {
  return {
    ...result,
    data: normalizeStaff(result.data),
  };
}

export interface ListStaffParams {
  page?: number;
  perPage?: number;
  search?: string;
}

export interface CreateStaffPayload {
  name: string;
  nik?: string;
  address?: string;
  job_title: string;
  salary_amount: number;
  join_date?: string;
  payout_day_of_month?: number;
  ktp_photo_url?: string;
  benefits?: string;
  bank_name?: string;
  bank_account_holder_name?: string;
  bank_account_number?: string;
}

export type UpdateStaffPayload = CreateStaffPayload;

/** Map form values to an API payload. */
export function staffFormToPayload(
  values: StaffFormValues,
): CreateStaffPayload {
  const salary = values.salary_amount;
  const payload: CreateStaffPayload = {
    name: values.name.trim(),
    job_title: values.job_title,
    salary_amount:
      salary === undefined || Number.isNaN(salary) ? 0 : salary,
  };

  const nik = values.nik.trim();
  if (nik) {
    payload.nik = nik;
  }

  const address = values.address.trim();
  if (address) {
    payload.address = address;
  }

  const ktpPhotoUrl = values.ktp_photo_url?.trim();
  if (ktpPhotoUrl) {
    payload.ktp_photo_url = ktpPhotoUrl;
  }

  const benefits = values.benefits?.trim();
  if (benefits) {
    payload.benefits = benefits;
  }

  const bankName = values.bank_name?.trim();
  const bankAccountNumber = values.bank_account_number?.trim();
  if (bankName && bankAccountNumber) {
    payload.bank_name = bankName;
    payload.bank_account_number = bankAccountNumber;

    const bankAccountHolderName = values.bank_account_holder_name?.trim();
    if (bankAccountHolderName) {
      payload.bank_account_holder_name = bankAccountHolderName;
    }
  }

  if (payload.salary_amount >= 1) {
    payload.join_date = values.join_date?.trim();
    payload.payout_day_of_month = values.payout_day_of_month;
  }

  return payload;
}

export const staffAdminApi = {
  list: async ({
    page = 1,
    perPage = 10,
    search = "",
  }: ListStaffParams = {}) => {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    if (search) params.set("search", search);
    const result = await api.get<StaffRaw[]>(
      `/api/admin/staff?${params.toString()}`,
    );
    return normalizeListResult(result);
  },

  get: async (id: string) => {
    const result = await api.get<StaffRaw>(`/api/admin/staff/${id}`);
    return normalizeItemResult(result);
  },

  create: async (payload: CreateStaffPayload) => {
    const result = await api.post<StaffRaw>("/api/admin/staff", payload);
    return normalizeItemResult(result);
  },

  update: async (id: string, payload: UpdateStaffPayload) => {
    const result = await api.put<StaffRaw>(
      `/api/admin/staff/${id}`,
      payload,
    );
    return normalizeItemResult(result);
  },

  delete: (id: string) => api.delete<void>(`/api/admin/staff/${id}`),
};

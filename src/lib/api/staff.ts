import { api, type ApiResult } from "./client";
import { parseNumeric } from "./suppliers";
import type { Staff } from "./types";
import type { StaffFormValues } from "@/lib/validations";

/** Wire format from the Go backend (`decimal.Decimal` marshals as JSON string). */
interface StaffRaw extends Omit<Staff, "salary_amount"> {
  salary_amount: number | string;
}

export function normalizeStaff(raw: StaffRaw): Staff {
  return {
    ...raw,
    salary_amount: parseNumeric(raw.salary_amount),
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
  nik: string;
  address: string;
  job_title: string;
  salary_amount: number;
  ktp_photo_url?: string;
  benefits?: string;
}

export type UpdateStaffPayload = CreateStaffPayload;

/** Map form values to an API payload. */
export function staffFormToPayload(
  values: StaffFormValues,
): CreateStaffPayload {
  const salary = values.salary_amount;
  const payload: CreateStaffPayload = {
    name: values.name.trim(),
    nik: values.nik.trim(),
    address: values.address,
    job_title: values.job_title,
    salary_amount:
      salary === undefined || Number.isNaN(salary) ? 0 : salary,
  };

  const ktpPhotoUrl = values.ktp_photo_url?.trim();
  if (ktpPhotoUrl) {
    payload.ktp_photo_url = ktpPhotoUrl;
  }

  const benefits = values.benefits?.trim();
  if (benefits) {
    payload.benefits = benefits;
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

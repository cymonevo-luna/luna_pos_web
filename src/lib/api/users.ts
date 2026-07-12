import { api } from "./client";
import type { MerchantRole, User } from "./types";
import type {
  AdminUserCreateFormValues,
  AdminUserRolesFormValues,
} from "@/lib/validations";

export interface ListUsersParams {
  page?: number;
  perPage?: number;
  search?: string;
}

export interface CreateUserPayload {
  email: string;
  name: string;
  password: string;
  roles: MerchantRole[];
}

export interface UpdateUserRolesPayload {
  roles: MerchantRole[];
}

export function adminUserCreateFormToPayload(
  values: AdminUserCreateFormValues,
): CreateUserPayload {
  return {
    email: values.email.trim(),
    name: values.name.trim(),
    password: values.password,
    roles: values.roles,
  };
}

export function adminUserRolesFormToPayload(
  values: AdminUserRolesFormValues,
): UpdateUserRolesPayload {
  return {
    roles: values.roles,
  };
}

export const usersApi = {
  get: (id: string) => api.get<User>(`/api/v1/users/${id}`),

  update: (id: string, payload: { name: string }) =>
    api.put<User>(`/api/v1/users/${id}`, payload),
};

export const adminApi = {
  listUsers: ({ page = 1, perPage = 10, search = "" }: ListUsersParams = {}) => {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    if (search) params.set("search", search);
    return api.get<User[]>(`/api/admin/users?${params.toString()}`);
  },

  getUser: (id: string) => api.get<User>(`/api/admin/users/${id}`),

  createUser: (payload: CreateUserPayload) =>
    api.post<User>("/api/admin/users", payload),

  updateUserRoles: (id: string, payload: UpdateUserRolesPayload) =>
    api.put<User>(`/api/admin/users/${id}/roles`, payload),

  deleteUser: (id: string) => api.delete<void>(`/api/admin/users/${id}`),
};

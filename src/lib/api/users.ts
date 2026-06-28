import { api } from "./client";
import type { User } from "./types";

export interface ListUsersParams {
  page?: number;
  perPage?: number;
  search?: string;
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

  deleteUser: (id: string) => api.delete<void>(`/api/admin/users/${id}`),
};

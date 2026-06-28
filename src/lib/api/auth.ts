import { api } from "./client";
import type { LoginResult, User } from "./types";

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const authApi = {
  register: (payload: RegisterPayload) =>
    api.post<User>("/api/v1/auth/register", payload, { auth: false }),

  login: (payload: LoginPayload) =>
    api.post<LoginResult>("/api/v1/auth/login", payload, { auth: false }),
};

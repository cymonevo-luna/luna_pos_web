/**
 * API contract types mirroring the companion Go backend (go_template).
 * Every endpoint returns the same `Envelope` shape.
 */

export type Role = "admin" | "user";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  created_at: string;
  updated_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface PageMeta {
  page: number;
  per_page: number;
  total: number;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

export interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: ApiErrorBody;
  meta?: PageMeta;
}

export interface LoginResult {
  tokens: TokenPair;
  user: User;
}

export interface RefreshResult {
  tokens: TokenPair;
}

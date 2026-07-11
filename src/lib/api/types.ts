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

export type FoodSupplyUnit = "ml" | "piece" | "gr";

export interface FoodSupply {
  id: string;
  title: string;
  description?: string | null;
  stock_quantity: number;
  unit: FoodSupplyUnit;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface Menu {
  id: string;
  title: string;
  description?: string | null;
  category_id: string;
  category_name: string;
  photo_url?: string | null;
  available_stock: number;
  sell_price: number;
  recipe_yield?: number;
  margin_percent?: number;
  vat_percent?: number;
  created_at: string;
  updated_at: string;
}

export type TransactionMethod = "OFFLINE";

export type TransactionSummaryPeriod = "daily" | "weekly" | "monthly";

export interface TransactionLineItem {
  menu_id: string;
  title: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface Transaction {
  id: string;
  method: TransactionMethod;
  amount: number;
  cash_tendered: number;
  change_amount: number;
  cashier_user_id: string;
  cashier_username: string;
  items: TransactionLineItem[];
  transaction_date: string;
  created_at: string;
}

export interface TransactionSummaryBucket {
  period_start: string;
  period_label: string;
  count: number;
  total_amount: number;
}

export interface TransactionSummary {
  period: TransactionSummaryPeriod;
  buckets: TransactionSummaryBucket[];
}

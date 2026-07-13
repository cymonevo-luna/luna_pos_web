/**
 * API contract types mirroring the companion Go backend (go_template).
 * Every endpoint returns the same `Envelope` shape.
 */

/** Roles assignable to merchant users (admin UI + API). */
export type MerchantRole =
  | "admin"
  | "manager"
  | "cashier"
  | "operational";

/** Merchant summary persisted in the auth session. */
export interface SessionMerchant {
  id: string;
  name: string;
}

export interface Merchant extends SessionMerchant {
  address: string;
  phone: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  roles: MerchantRole[];
  merchant_id: string;
  created_at: string;
  updated_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in?: number;
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
  merchant: SessionMerchant;
}

/** Returned when login requires the user to pick a merchant. */
export interface MerchantChoice {
  id: string;
  name: string;
}

export interface MerchantRegisterResult {
  tokens: TokenPair;
  user: User;
  merchant: Merchant;
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

export interface SupplierPrice {
  id: string;
  food_supply_id: string;
  food_supply_title?: string;
  unit: FoodSupplyUnit;
  price_amount: number;
  price_quantity: number;
  unit_price?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone_number: string;
  address: string;
  supports_delivery: boolean;
  delivery_cost: number | null;
  price_quotes: SupplierPrice[];
  price_quotes_count?: number;
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

export interface MenuIngredientInput {
  food_supply_id: string;
  quantity_per_unit: number;
}

export interface MenuIngredient extends MenuIngredientInput {
  food_supply_title: string;
  food_supply_unit: FoodSupplyUnit;
  food_supply_stock_quantity: number;
}

export interface FormulaResponse {
  menu_id: string;
  ingredients: MenuIngredient[];
}

export interface StockEstimationIngredient {
  food_supply_title: string;
  unit: FoodSupplyUnit;
  quantity_per_unit: number;
  required_quantity: number;
  current_stock_quantity: number;
  remaining_after: number;
  is_sufficient: boolean;
}

export interface StockEstimationResponse {
  has_formula: boolean;
  requested_quantity: number;
  max_producible?: number;
  is_fully_producible?: boolean;
  limiting_ingredient_title?: string | null;
  message?: string;
  ingredients?: StockEstimationIngredient[];
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

export interface CashFlowSummaryTotals {
  inflow_amount: number;
  inflow_count: number;
  outflow_amount: number;
  outflow_count: number;
  net_amount: number;
}

export interface CashFlowSummary {
  period: TransactionSummaryPeriod;
  totals: CashFlowSummaryTotals;
}

export type CogsStatus = "complete" | "missing_prices" | "no_formula";

/** Summary row returned by GET /api/admin/cogs. */
export interface CogsMenuSummary {
  menu_id: string;
  title: string;
  category_id: string;
  category_name: string;
  cogs_per_piece: number | null;
  margin_percent: number;
  vat_percent: number;
  price_after_margin: number | null;
  price_after_vat: number | null;
  recommended_offline: number | null;
  recommended_online: number | null;
  sell_price: number;
  status: CogsStatus;
}

export interface CogsSupplierQuote {
  supplier_id: string;
  supplier_name: string;
  unit_price: number;
  selected: boolean;
}

export interface CogsIngredientBreakdown {
  food_supply_id: string;
  food_supply_title: string;
  quantity_batch: number;
  quantity_per_piece: number;
  unit: FoodSupplyUnit;
  selected_supplier_id: string | null;
  selected_supplier_name: string | null;
  selected_unit_price: number | null;
  supplier_quotes: CogsSupplierQuote[];
  line_cost: number | null;
}

/** Full breakdown returned by GET /api/admin/cogs/{menu_id}. */
export interface CogsMenuDetail extends CogsMenuSummary {
  recipe_yield: number;
  ingredients: CogsIngredientBreakdown[];
  total_cogs: number | null;
}

/** Receipt header/footer settings returned by GET /api/admin/store-settings. */
export interface StoreSettings {
  brand_name: string;
  branch_name: string;
  address: string;
  phone: string;
  thank_you_note: string;
}

export type PurchaseRequestStatus =
  | "PENDING"
  | "REQUESTED"
  | "PAID"
  | "DELIVERED";

export interface PurchaseRequestItem {
  id: string;
  food_supply_id: string;
  food_supply_title?: string;
  unit?: FoodSupplyUnit;
  quantity: number;
  price_quantity: number;
  unit_price: number;
  price_amount: number;
  line_estimated_amount: number;
}

export interface PurchaseRequestStatusHistoryEntry {
  id: string;
  from_status: string | null;
  to_status: string;
  changed_by_username: string;
  photo_url: string | null;
  created_at: string;
}

export interface PurchaseRequest {
  id: string;
  supplier_id: string;
  supplier_name: string;
  supplier_contact_info: string;
  status: PurchaseRequestStatus;
  notes?: string | null;
  items: PurchaseRequestItem[];
  status_history: PurchaseRequestStatusHistoryEntry[];
  total_estimated_amount: number;
  created_by_username?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseRequestSummary {
  id: string;
  supplier_id: string;
  supplier_name: string;
  status: PurchaseRequestStatus;
  item_count: number;
  total_estimated_amount: number;
  created_by_username?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type ProductionRequestStatus =
  | "REQUESTED"
  | "ACCEPTED"
  | "READY_TO_PICK"
  | "DONE";

/** Ingredient line within a per-menu stock estimation on production requests. */
export interface ProductionStockEstimationIngredient
  extends StockEstimationIngredient {
  food_supply_id: string;
  max_producible_from_supply?: number;
}

export interface ProductionLineStockEstimation {
  has_formula: boolean;
  is_fully_producible: boolean;
  limiting_ingredient_id?: string;
  limiting_ingredient_title?: string | null;
  message?: string;
  ingredients: ProductionStockEstimationIngredient[];
}

export interface ProductionAggregatedIngredient {
  food_supply_id: string;
  food_supply_title: string;
  unit: FoodSupplyUnit;
  required_quantity: number;
  current_stock_quantity: number;
  remaining_after: number;
  is_sufficient: boolean;
}

export interface ProductionRequestItem {
  id: string;
  menu_id: string;
  menu_title: string;
  quantity: number;
  is_finished: boolean;
  stock_estimation: ProductionLineStockEstimation;
}

export interface ProductionRequestStatusHistoryEntry {
  id: string;
  from_status: ProductionRequestStatus | null;
  to_status: ProductionRequestStatus;
  changed_by_username: string;
  created_at: string;
}

export interface ProductionRequest {
  id: string;
  status: ProductionRequestStatus;
  is_fully_producible: boolean;
  items: ProductionRequestItem[];
  aggregated_ingredients: ProductionAggregatedIngredient[];
  status_history: ProductionRequestStatusHistoryEntry[];
  created_by_user_id?: string | null;
  created_by_username?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductionRequestSummary {
  id: string;
  status: ProductionRequestStatus;
  is_fully_producible: boolean;
  item_count: number;
  created_by_username?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductionRequestEstimateItem {
  menu_id: string;
  menu_title: string;
  quantity: number;
  stock_estimation: ProductionLineStockEstimation;
}

export interface ProductionRequestEstimateResponse {
  is_fully_producible: boolean;
  items: ProductionRequestEstimateItem[];
  aggregated_ingredients: ProductionAggregatedIngredient[];
}

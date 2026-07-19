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

/** Privilege feature registered in the backend feature registry. */
export interface Feature {
  key: string;
  name: string;
  description?: string;
  category: "admin" | "pos";
  sort_order: number;
}

/** Enabled feature keys for a merchant role. */
export interface RoleFeatureMapping {
  role: MerchantRole;
  features: string[];
}

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
  features?: string[];
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
  features?: string[];
}

export type FoodSupplyUnit = "ml" | "piece" | "gr";

export interface FoodSupplyManualEditHistoryEntry {
  delta_quantity: string;
  previous_quantity: string;
  new_quantity: string;
  changed_by_username: string;
  created_at: string;
}

export interface CookingMeasurement {
  id: string;
  name: string;
  conversion_quantity: string;
}

export interface FoodSupply {
  id: string;
  title: string;
  description?: string | null;
  stock_quantity: number;
  unit: FoodSupplyUnit;
  has_supplier_price: boolean;
  created_at: string;
  updated_at: string;
  manual_edit_history: FoodSupplyManualEditHistoryEntry[];
  cooking_measurements: CookingMeasurement[];
}

export interface BranchAsset {
  id: string;
  title: string;
  description?: string | null;
  photo_url?: string | null;
  quantity: number;
  price_amount: number;
  line_value: number;
  created_at: string;
  updated_at: string;
}

export type RecurringExpenseInterval = "DATE" | "DAY" | "DAILY";

export interface RecurringExpenseScheduleTime {
  hour: number;
  minute: number;
  second: number;
}

export interface RecurringExpenseSchedule {
  interval: RecurringExpenseInterval;
  value?: number | null;
  time: RecurringExpenseScheduleTime;
}

export interface RecurringExpense {
  id: string;
  title: string;
  description?: string | null;
  amount: number;
  is_active: boolean;
  recurring: RecurringExpenseSchedule;
  next_run_at?: string | null;
  /** Set when this expense is auto-managed from a staff salary record. */
  staff_id?: string | null;
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

/** Supplier price quote for a food supply (from food-supply supplier-prices endpoint). */
export interface FoodSupplySupplierPrice extends SupplierPrice {
  supplier_id: string;
  supplier_name: string;
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

export interface Staff {
  id: string;
  name: string;
  nik: string;
  ktp_photo_url?: string | null;
  address: string;
  job_title: string;
  salary_amount: number;
  /** Auto-managed recurring expense linked to salary payouts. */
  recurring_expense_id?: string | null;
  benefits?: string | null;
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

export interface OrderOption {
  id: string;
  name: string;
  priority: number;
  ingredient_count: number;
  created_at: string;
  updated_at: string;
}

export interface OrderOptionIngredientInput {
  food_supply_id: string;
  quantity: number;
}

export interface OrderOptionIngredient extends OrderOptionIngredientInput {
  food_supply_title: string;
  food_supply_unit: FoodSupplyUnit;
  current_stock_quantity: number;
}

export interface OrderOptionIngredientsResponse {
  order_option_id: string;
  ingredients: OrderOptionIngredient[];
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

export interface FoodSupplyMenuIngredientInput {
  food_supply_id: string;
  quantity_per_unit: number;
  cooking_measurement_id?: string;
}

export interface MenuReferenceMenuIngredientInput {
  ingredient_menu_id: string;
  quantity_per_unit: number;
}

export type MenuIngredientInput =
  | FoodSupplyMenuIngredientInput
  | MenuReferenceMenuIngredientInput;

export function isMenuReferenceIngredient(
  line: MenuIngredientInput | MenuIngredient,
): line is MenuReferenceMenuIngredientInput | MenuReferenceMenuIngredient {
  return (
    "ingredient_menu_id" in line &&
    typeof line.ingredient_menu_id === "string" &&
    line.ingredient_menu_id.length > 0
  );
}

export interface MenuIngredient {
  quantity_per_unit: number;
  food_supply_id?: string;
  food_supply_title?: string;
  food_supply_unit?: FoodSupplyUnit;
  food_supply_stock_quantity?: number;
  /** Chef-entered quantity when a cooking measurement is selected. */
  entry_quantity?: number;
  cooking_measurement_id?: string;
  cooking_measurement_name?: string | null;
  ingredient_menu_id?: string;
  ingredient_menu_title?: string;
}

export interface MenuReferenceMenuIngredient extends MenuIngredient {
  ingredient_menu_id: string;
  ingredient_menu_title: string;
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

export type TransactionMethod = "CASH" | "QRIS";

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

export interface CashFlowSummaryBucket {
  period_start: string;
  period_label: string;
  inflow_amount: number;
  outflow_amount: number;
  net_amount: number;
  /** Estimated production COGS for the bucket when returned by the API. */
  production_cost_amount?: number;
}

/** Wire format from cash-flow summary API (`inflow_by_method` rows). */
export interface CashFlowInflowByMethod {
  method: TransactionMethod;
  total_amount: number;
  count: number;
}

/** Normalized inflow row for UI (`amount` mapped from `total_amount`). */
export interface CashFlowInflowByMethodNormalized
  extends Omit<CashFlowInflowByMethod, "total_amount"> {
  amount: number;
}

export type CashFlowOutflowSource =
  | "purchases"
  | "expenses"
  | "staff_payouts";

/** Wire format from cash-flow summary API (`outflow_by_source` rows). */
export interface CashFlowOutflowBySource {
  source: CashFlowOutflowSource;
  total_amount: number;
  count: number;
}

/** Normalized outflow row for UI (`amount` mapped from `total_amount`). */
export interface CashFlowOutflowBySourceNormalized
  extends Omit<CashFlowOutflowBySource, "total_amount"> {
  amount: number;
}

export interface CashFlowProductionCost {
  total_estimated_cost: number;
  completed_request_count: number;
  items_without_cogs_count: number;
}

export interface CashFlowSummary {
  period: TransactionSummaryPeriod;
  totals: CashFlowSummaryTotals;
  buckets: CashFlowSummaryBucket[];
  inflow_by_method?: CashFlowInflowByMethodNormalized[];
  outflow_by_source?: CashFlowOutflowBySourceNormalized[];
  production_cost?: CashFlowProductionCost;
}

/** Wire format from GET /api/admin/insights/transactions/by-menu. */
export interface TransactionMenuInsightItemRaw {
  menu_id: string;
  menu_title: string;
  quantity_sold: number;
  revenue: number;
  revenue_share_percent: number;
  quantity_share_percent: number;
}

export interface TransactionMenuInsightItem {
  menu_id: string;
  menu_title: string;
  quantity_sold: number;
  revenue: number;
  /** Mapped from `revenue_share_percent` for UI display. */
  share_percent: number;
  quantity_share_percent?: number;
}

export interface TransactionMenuInsights {
  date_from: string;
  date_to: string;
  total_revenue: number;
  menus: TransactionMenuInsightItem[];
}

/** Wire format from GET /api/admin/insights/transactions/by-menu. */
export interface TransactionMenuInsightsRaw {
  date_from: string;
  date_to: string;
  total_revenue: number;
  menus: TransactionMenuInsightItemRaw[];
}

export type ProductionInsightConfidence = "high" | "medium" | "low";

/** Wire item from GET /api/admin/insights/production/next-day (`menus[]`). */
export interface ProductionNextDayInsightItemRaw {
  menu_id: string;
  menu_title: string;
  current_available_stock: number;
  avg_daily_sales: number;
  projected_demand: number;
  recommended_production_qty: number;
  max_producible_from_ingredients: number | null;
  is_limited_by_ingredients: boolean;
  confidence: ProductionInsightConfidence;
}

/**
 * Normalized production insight row for UI.
 * Mapped from {@link ProductionNextDayInsightItemRaw} in the insights API client:
 * `current_stock` ← `current_available_stock`,
 * `max_producible` ← `max_producible_from_ingredients`,
 * `limited_by_ingredients` ← `is_limited_by_ingredients`.
 */
export interface ProductionNextDayInsightItem {
  menu_id: string;
  menu_title: string;
  current_stock: number;
  avg_daily_sales: number;
  projected_demand: number;
  recommended_production_qty: number;
  max_producible: number | null;
  confidence: ProductionInsightConfidence;
  limited_by_ingredients: boolean;
  /** Not provided by the backend; reserved for future UI if the API adds it. */
  limiting_ingredient_title?: string | null;
}

/** Wire `data` payload from GET /api/admin/insights/production/next-day. */
export interface ProductionNextDayInsightRaw {
  target_date: string;
  lookback_days: number;
  generated_at: string;
  menus: ProductionNextDayInsightItemRaw[];
}

/**
 * Normalized production next-day insight for UI.
 * Mapped from {@link ProductionNextDayInsightRaw} in the insights API client (`menus` → `items`).
 */
export interface ProductionNextDayInsight {
  target_date: string;
  lookback_days: number;
  generated_at: string;
  items: ProductionNextDayInsightItem[];
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

/** Category row in GET /api/admin/cogs/portfolio-summary. */
export interface CogsPortfolioCategoryBreakdown {
  category_id: string;
  category_name: string;
  menu_count: number;
  complete_count: number;
  avg_margin_percent: number;
  avg_cogs_per_piece: number | null;
}

/** Recommended vs current sell price totals when provided by the API. */
export interface CogsPortfolioVariance {
  total_recommended_sell_price: number;
  total_current_sell_price: number;
  variance_amount: number;
  variance_percent: number;
}

/** Portfolio-level COGS aggregates from GET /api/admin/cogs/portfolio-summary. */
export interface CogsPortfolioSummary {
  generated_at: string;
  total_menus: number;
  complete_count: number;
  missing_prices_count: number;
  no_formula_count: number;
  avg_margin_percent: number;
  avg_cogs_per_piece: number | null;
  variance?: CogsPortfolioVariance | null;
  categories: CogsPortfolioCategoryBreakdown[];
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

/** Supplier price quote returned by smart purchase suggest / food-supply supplier-prices. */
export interface PurchaseRequestSupplierQuote {
  supplier_id: string;
  supplier_name: string;
  supplier_price_id?: string;
  price_amount: number;
  price_quantity: number;
  unit_price: number;
}

/** Single ingredient line in a smart purchase suggest response. */
export interface PurchaseRequestSuggestItem {
  food_supply_id: string;
  food_supply_title: string;
  quantity: number;
  unit: FoodSupplyUnit;
  has_supplier_price: boolean;
  selected_supplier_id?: string | null;
  selected_supplier_name?: string | null;
  price_amount: number;
  price_quantity: number;
  unit_price: number;
  line_estimated_amount: number;
  all_supplier_quotes: PurchaseRequestSupplierQuote[];
}

/** Items grouped by supplier from smart purchase suggest. */
export interface PurchaseRequestSupplierGroup {
  supplier_id: string;
  supplier_name: string;
  items: PurchaseRequestSuggestItem[];
  group_total_estimated_amount?: number;
}

export interface PurchaseRequestSuggestResponse {
  items: PurchaseRequestSuggestItem[];
  grouped_by_supplier: PurchaseRequestSupplierGroup[];
}

export interface BatchPurchaseRequestsResponse {
  purchase_requests: PurchaseRequest[];
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

/** Profit lookback metadata from GET /api/admin/branch-assets/summary. */
export interface BranchAssetsProfitSource {
  lookback_days: number;
  date_from: string;
  date_to: string;
  net_amount_total: number;
}

export type ExpenseSourceOfFund = "CASHIER" | "PERSONAL_MONEY";

export interface Expense {
  id: string;
  title: string;
  description?: string | null;
  amount: number;
  source_of_fund?: ExpenseSourceOfFund;
  receipt_url?: string | null;
  created_by_user_id?: string | null;
  created_by_username?: string | null;
  created_at: string;
  updated_at: string;
}

/** Wire `data` payload from GET /api/admin/branch-assets/summary. */
export interface BranchAssetsSummary {
  total_asset_value: number;
  asset_count: number;
  total_quantity: number;
  profit_daily_avg: number;
  profit_monthly_avg: number;
  bep_days: number | null;
  bep_months: number | null;
  bep_message: string | null;
  bep_reachable: boolean;
  profit_source: BranchAssetsProfitSource;
}

/** Historical profit averages from GET /api/admin/insights/bep/projection. */
export interface BEPHistoricalSection {
  profit_daily_avg: number;
  profit_monthly_avg: number;
  net_amount_total: number;
  lookback_days: number;
  date_from: string;
  date_to: string;
}

/** Break-even estimates from GET /api/admin/insights/bep/projection. */
export interface BEPBreakEvenSection {
  bep_days: number | null;
  bep_months: number | null;
  bep_reachable: boolean;
  bep_message: string | null;
}

/** One forward day in the BEP cash-flow projection. */
export interface BEPProjectionBucket {
  day_offset: number;
  date: string;
  projected_inflow: number;
  projected_outflow: number;
  projected_production_cost: number;
  projected_net: number;
  cumulative_net: number;
}

/** Recurring expense due within the projection window. */
export interface UpcomingRecurringExpense {
  recurring_expense_id: string;
  title: string;
  amount: number;
  next_run_at: string;
}

/** Forward-looking projection section from GET /api/admin/insights/bep/projection. */
export interface BEPProjectionSection {
  projection_days: number;
  daily_inflow_avg: number;
  daily_expense_avg: number;
  daily_staff_payout_avg: number;
  daily_production_cost_avg: number;
  daily_net_projected: number;
  buckets: BEPProjectionBucket[];
  upcoming_recurring_expenses: UpcomingRecurringExpense[];
}

/** Wire `data` payload from GET /api/admin/insights/bep/projection. */
export interface BEPProjectionResponse {
  total_asset_value: number;
  asset_count: number;
  historical: BEPHistoricalSection;
  bep: BEPBreakEvenSection;
  projection: BEPProjectionSection;
  generated_at: string;
}

export type CashierBalanceAdjustmentType = "ADD" | "DEDUCT";

export type CashierBalanceEntrySource =
  | "MANUAL"
  | "EXPENSE"
  | "CASH_PAYMENT"
  | "CASH_CHANGE"
  | "TRANSACTION_REVERSAL";

/** Wire `data` payload from GET /api/admin/cashier-balance. */
export interface CashierBalance {
  balance: number;
  updated_at?: string;
}

/** One ledger entry from GET /api/admin/cashier-balance/entries. */
export interface CashierBalanceEntry {
  id: string;
  type: CashierBalanceAdjustmentType;
  source: CashierBalanceEntrySource;
  amount: number;
  purpose: string;
  transaction_id?: string | null;
  requested_by_user_id?: string | null;
  requested_by_username?: string | null;
  created_at: string;
}

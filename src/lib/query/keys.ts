import type { ListCategoriesParams } from "@/lib/api/categories";
import type { CashFlowSummaryParams } from "@/lib/api/cash-flow";
import type { ListMenusParams } from "@/lib/api/menus";
import type {
  ListTransactionsParams,
  SummaryTransactionsParams,
} from "@/lib/api/transactions";
import type { ListUsersParams } from "@/lib/api/users";

export const queryKeys = {
  users: {
    all: ["users"] as const,
    detail: (id: string) => [...queryKeys.users.all, "detail", id] as const,
    lists: () => [...queryKeys.users.all, "list"] as const,
    list: (params: ListUsersParams) =>
      [...queryKeys.users.lists(), params] as const,
  },
  transactions: {
    all: ["transactions"] as const,
    lists: () => [...queryKeys.transactions.all, "list"] as const,
    list: (params: ListTransactionsParams) =>
      [...queryKeys.transactions.lists(), params] as const,
    summaries: () => [...queryKeys.transactions.all, "summary"] as const,
    summary: (params: SummaryTransactionsParams) =>
      [...queryKeys.transactions.summaries(), params] as const,
  },
  cashFlow: {
    all: ["cash-flow"] as const,
    summaries: () => [...queryKeys.cashFlow.all, "summary"] as const,
    summary: (params: CashFlowSummaryParams) =>
      [...queryKeys.cashFlow.summaries(), params] as const,
  },
  categories: {
    all: ["categories"] as const,
    lists: () => [...queryKeys.categories.all, "list"] as const,
    list: (params: ListCategoriesParams) =>
      [...queryKeys.categories.lists(), params] as const,
  },
  menus: {
    all: ["menus"] as const,
    lists: () => [...queryKeys.menus.all, "list"] as const,
    list: (params: ListMenusParams) =>
      [...queryKeys.menus.lists(), params] as const,
  },
  storeSettings: {
    all: ["store-settings"] as const,
    detail: () => [...queryKeys.storeSettings.all, "detail"] as const,
  },
  suppliers: {
    all: ["suppliers"] as const,
    lists: () => [...queryKeys.suppliers.all, "list"] as const,
    list: (params: { page?: number; perPage?: number }) =>
      [...queryKeys.suppliers.lists(), params] as const,
  },
  purchaseRequests: {
    all: ["purchase-requests"] as const,
    lists: () => [...queryKeys.purchaseRequests.all, "list"] as const,
    list: (params: { page?: number; perPage?: number }) =>
      [...queryKeys.purchaseRequests.lists(), params] as const,
  },
};

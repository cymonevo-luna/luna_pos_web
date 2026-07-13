import {
  cashFlowSummary,
  type CashFlowSummaryParams,
} from "./insights";

export type { CashFlowSummaryParams };

export const cashFlowAdminApi = {
  summary: cashFlowSummary,
};

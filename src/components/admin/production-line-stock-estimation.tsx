"use client";

import type {
  ProductionLineStockEstimation as ProductionLineStockEstimationData,
  ProductionRequestEstimateItem,
  ProductionRequestItem,
} from "@/lib/api/types";
import { formatStockQuantity, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type ProductionLineWithStockEstimation =
  | ProductionRequestEstimateItem
  | ProductionRequestItem;

function formatQuantity(quantity: number, unit: string) {
  return formatStockQuantity(quantity, unit);
}

export interface ProductionLineStockEstimationProps {
  item: ProductionLineWithStockEstimation;
  /** When false, menu title and quantity are omitted (e.g. when shown in a parent row). */
  showHeader?: boolean;
}

export function ProductionLineStockEstimation({
  item,
  showHeader = true,
}: ProductionLineStockEstimationProps) {
  const estimation: ProductionLineStockEstimationData = item.stock_estimation;

  if (!estimation.has_formula) {
    return (
      <p
        className="text-muted-foreground rounded-xl border border-border bg-muted/30 p-3 text-sm"
        data-testid={`production-estimation-no-formula-${item.menu_id}`}
      >
        {estimation.message ||
          "No ingredient formula saved for this menu. Add and save ingredients first."}
      </p>
    );
  }

  return (
    <div
      className="space-y-3"
      data-testid={`production-estimation-line-${item.menu_id}`}
    >
      {showHeader ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-medium">{item.menu_title}</p>
          <p className="text-muted-foreground text-sm">
            Qty: <span className="font-medium">{item.quantity}</span>
          </p>
          <Badge
            variant={estimation.is_fully_producible ? "success" : "destructive"}
            data-testid={`production-estimation-status-badge-${item.menu_id}`}
          >
            {estimation.is_fully_producible
              ? "Sufficient stock"
              : "Insufficient stock"}
          </Badge>
        </div>
      ) : (
        <Badge
          variant={estimation.is_fully_producible ? "success" : "destructive"}
          data-testid={`production-estimation-status-badge-${item.menu_id}`}
        >
          {estimation.is_fully_producible
            ? "Sufficient stock"
            : "Insufficient stock"}
        </Badge>
      )}

      {estimation.limiting_ingredient_title && !estimation.is_fully_producible && (
        <p
          className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
          data-testid={`production-estimation-limiting-ingredient-${item.menu_id}`}
        >
          Limiting ingredient:{" "}
          <span className="font-medium">{estimation.limiting_ingredient_title}</span>
        </p>
      )}

      {estimation.ingredients.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Food supply</th>
                <th className="px-3 py-2 font-medium">Dosage / menu</th>
                <th className="px-3 py-2 font-medium">Required</th>
                <th className="px-3 py-2 font-medium">Current stock</th>
                <th className="px-3 py-2 font-medium">Remaining</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {estimation.ingredients.map((ingredient) => {
                const isLimiting =
                  estimation.limiting_ingredient_title ===
                  ingredient.food_supply_title;
                return (
                  <tr
                    key={`${item.menu_id}-${ingredient.food_supply_title}`}
                    className={cn(
                      "border-b border-border last:border-0",
                      isLimiting && "bg-amber-50/80 dark:bg-amber-950/20",
                    )}
                  >
                    <td className="px-3 py-2 font-medium">
                      {ingredient.food_supply_title}
                    </td>
                    <td className="px-3 py-2">
                      {formatQuantity(
                        ingredient.quantity_per_unit,
                        ingredient.unit,
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {formatQuantity(
                        ingredient.required_quantity,
                        ingredient.unit,
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {formatQuantity(
                        ingredient.current_stock_quantity,
                        ingredient.unit,
                      )}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2",
                        ingredient.remaining_after < 0 &&
                          "text-destructive font-medium",
                      )}
                    >
                      {formatQuantity(
                        ingredient.remaining_after,
                        ingredient.unit,
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant={
                          ingredient.is_sufficient ? "success" : "destructive"
                        }
                      >
                        {ingredient.is_sufficient ? "OK" : "Low"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

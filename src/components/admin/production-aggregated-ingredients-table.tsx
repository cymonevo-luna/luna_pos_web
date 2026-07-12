"use client";

import type { ProductionAggregatedIngredient } from "@/lib/api/types";
import { formatStockQuantity } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

function formatQuantity(quantity: number, unit: string) {
  return formatStockQuantity(quantity, unit);
}

export interface ProductionAggregatedIngredientsTableProps {
  ingredients: ProductionAggregatedIngredient[];
  title?: string;
  testId?: string;
}

export function ProductionAggregatedIngredientsTable({
  ingredients,
  title,
  testId = "production-estimation-aggregated-ingredients",
}: ProductionAggregatedIngredientsTableProps) {
  if (ingredients.length === 0) return null;

  return (
    <div className="space-y-2" data-testid={testId}>
      {title ? <h5 className="text-sm font-semibold">{title}</h5> : null}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Food supply</th>
              <th className="px-3 py-2 font-medium">Required</th>
              <th className="px-3 py-2 font-medium">Current stock</th>
              <th className="px-3 py-2 font-medium">Remaining</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {ingredients.map((ingredient) => (
              <tr
                key={ingredient.food_supply_id}
                className="border-b border-border last:border-0"
              >
                <td className="px-3 py-2 font-medium">
                  {ingredient.food_supply_title}
                </td>
                <td className="px-3 py-2">
                  {formatQuantity(ingredient.required_quantity, ingredient.unit)}
                </td>
                <td className="px-3 py-2">
                  {formatQuantity(
                    ingredient.current_stock_quantity,
                    ingredient.unit,
                  )}
                </td>
                <td
                  className={
                    ingredient.remaining_after < 0
                      ? "text-destructive px-3 py-2 font-medium"
                      : "px-3 py-2"
                  }
                >
                  {formatQuantity(ingredient.remaining_after, ingredient.unit)}
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

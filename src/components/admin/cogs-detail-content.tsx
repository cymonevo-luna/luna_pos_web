"use client";

import type { CogsMenuDetail } from "@/lib/api/types";
import { formatRupiah, formatStockQuantity } from "@/lib/utils";
import { Card } from "@/components/ui/card";

function formatPercent(value: number) {
  return `${value}%`;
}

function formatMoney(value: number | null | undefined) {
  if (value == null) return "—";
  return formatRupiah(value);
}

export interface CogsDetailContentProps {
  detail: CogsMenuDetail;
}

export function CogsDetailContent({ detail }: CogsDetailContentProps) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Recipe yield</p>
          <p className="text-lg font-semibold">{detail.recipe_yield}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">COGS / piece</p>
          <p className="text-lg font-semibold">
            {formatMoney(detail.cogs_per_piece)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Margin</p>
          <p className="text-lg font-semibold">
            {formatPercent(detail.margin_percent)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">VAT</p>
          <p className="text-lg font-semibold">
            {formatPercent(detail.vat_percent)}
          </p>
        </Card>
      </div>

      <div className="mt-6">
        <h4 className="mb-3 text-sm font-medium">Price comparison</h4>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Current sell price</p>
            <p className="text-lg font-semibold">
              {formatRupiah(detail.sell_price)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Recommended offline</p>
            <p className="text-lg font-semibold">
              {formatMoney(detail.recommended_offline)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Recommended online</p>
            <p className="text-lg font-semibold">
              {formatMoney(detail.recommended_online)}
            </p>
          </Card>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Price after margin</p>
          <p className="text-lg font-semibold">
            {formatMoney(detail.price_after_margin)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Price after VAT</p>
          <p className="text-lg font-semibold">
            {formatMoney(detail.price_after_vat)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total COGS</p>
          <p className="text-lg font-semibold">
            {formatMoney(detail.total_cogs)}
          </p>
        </Card>
      </div>

      <div className="mt-6">
        <h4 className="mb-3 text-sm font-medium">Ingredient breakdown</h4>
        {detail.status === "no_formula" ||
        (detail.ingredients ?? []).length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">
            No ingredient formula configured for this menu.
          </Card>
        ) : (
          <div className="space-y-4">
            {detail.ingredients.map((ingredient) => (
              <Card
                key={
                  ingredient.food_supply_id || ingredient.food_supply_title
                }
                className="overflow-hidden"
              >
                <div className="border-b border-border bg-muted/30 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{ingredient.food_supply_title}</p>
                    <p className="text-sm font-medium">
                      Line cost: {formatMoney(ingredient.line_cost)}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Batch:{" "}
                    {formatStockQuantity(
                      ingredient.quantity_batch,
                      ingredient.unit,
                    )}
                    {" · "}
                    Per piece:{" "}
                    {formatStockQuantity(
                      ingredient.quantity_per_piece,
                      ingredient.unit,
                    )}
                  </p>
                  {ingredient.selected_supplier_name && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Selected supplier (highest price):{" "}
                      <span className="font-medium text-foreground">
                        {ingredient.selected_supplier_name}
                      </span>
                      {ingredient.selected_unit_price != null &&
                        ` · ${formatRupiah(ingredient.selected_unit_price)}`}
                    </p>
                  )}
                </div>
                {(ingredient.supplier_quotes ?? []).length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2 font-medium">Supplier</th>
                          <th className="px-4 py-2 font-medium">Unit price</th>
                          <th className="px-4 py-2 font-medium">Selected</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(ingredient.supplier_quotes ?? []).map((quote) => (
                          <tr
                            key={quote.supplier_id}
                            className={
                              quote.selected
                                ? "border-b border-border bg-success/10 last:border-0"
                                : "border-b border-border last:border-0"
                            }
                          >
                            <td className="px-4 py-2">{quote.supplier_name}</td>
                            <td className="px-4 py-2">
                              {formatRupiah(quote.unit_price)}
                            </td>
                            <td className="px-4 py-2">
                              {quote.selected ? "Yes" : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="px-4 py-3 text-sm text-muted-foreground">
                    No supplier quotes available.
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

"use client";

import * as React from "react";
import { useState } from "react";
import { getMenuStockEstimation } from "@/lib/api/menu-stock-estimation";
import { ApiError } from "@/lib/api/client";
import type { StockEstimationResponse } from "@/lib/api/types";
import { formatStockQuantity } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function parsePositiveInteger(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function formatQuantity(quantity: number, unit: string) {
  return formatStockQuantity(quantity, unit);
}

export interface MenuStockEstimationPanelProps {
  menuId: string;
  disabled?: boolean;
}

export function MenuStockEstimationPanel({
  menuId,
  disabled = false,
}: MenuStockEstimationPanelProps) {
  const [productionQuantity, setProductionQuantity] = useState("1");
  const [result, setResult] = useState<StockEstimationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quantityError, setQuantityError] = useState<string | null>(null);

  const parsedQuantity = parsePositiveInteger(productionQuantity);
  const canEstimate = parsedQuantity !== null && !disabled && !loading;

  const handleEstimate = async () => {
    const quantity = parsePositiveInteger(productionQuantity);
    if (quantity === null) {
      setQuantityError("Enter a whole number greater than 0");
      return;
    }

    setQuantityError(null);
    setError(null);
    setLoading(true);
    try {
      const response = await getMenuStockEstimation(menuId, quantity);
      setResult(response.data);
    } catch (err) {
      setResult(null);
      if (err instanceof ApiError) {
        if (err.status === 404) {
          setError("Menu not found. Close and reopen the editor.");
        } else if (err.status === 422) {
          setError(err.message || "Invalid production quantity.");
        } else {
          setError(err.message || "Failed to load stock estimation.");
        }
      } else {
        setError("Failed to load stock estimation.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setProductionQuantity(event.target.value);
    setQuantityError(null);
  };

  return (
    <section
      aria-label="Stock estimation"
      className="space-y-4 border-t border-border pt-4"
    >
      <div>
        <h4 className="text-base font-semibold">Stock Estimation</h4>
        <p className="text-muted-foreground text-sm">
          Estimate food supply usage for a production run. Results reflect the
          saved ingredient formula on the server.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-1.5 sm:max-w-48">
          <Label htmlFor="production-quantity">Production quantity</Label>
          <Input
            id="production-quantity"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={productionQuantity}
            disabled={disabled || loading}
            onChange={handleQuantityChange}
          />
          {quantityError && (
            <p className="text-destructive text-sm">{quantityError}</p>
          )}
        </div>
        <Button
          type="button"
          onClick={handleEstimate}
          isLoading={loading}
          disabled={!canEstimate}
        >
          Estimate
        </Button>
      </div>

      {loading && (
        <div className="space-y-3" data-testid="stock-estimation-loading">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {!loading && error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && result && !result.has_formula && (
        <p
          className="text-muted-foreground rounded-xl border border-border bg-muted/30 p-4 text-sm"
          data-testid="stock-estimation-no-formula"
        >
          {result.message ||
            "No ingredient formula saved for this menu. Add and save ingredients first."}
        </p>
      )}

      {!loading && !error && result?.has_formula && (
        <div className="space-y-4" data-testid="stock-estimation-results">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">
              Requested:{" "}
              <span className="font-medium">{result.requested_quantity}</span>
            </p>
            {result.max_producible !== undefined && (
              <p className="text-sm">
                Max producible:{" "}
                <span className="font-medium">{result.max_producible}</span>
              </p>
            )}
            {result.is_fully_producible !== undefined && (
              <Badge
                variant={result.is_fully_producible ? "success" : "destructive"}
                data-testid="stock-estimation-status-badge"
              >
                {result.is_fully_producible ? "Sufficient" : "Insufficient"}
              </Badge>
            )}
          </div>

          {result.limiting_ingredient_title && (
            <p
              className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
              data-testid="stock-estimation-limiting-ingredient"
            >
              Limiting ingredient:{" "}
              <span className="font-medium">
                {result.limiting_ingredient_title}
              </span>
            </p>
          )}

          {result.ingredients && result.ingredients.length > 0 && (
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
                  {result.ingredients.map((ingredient) => {
                    const isLimiting =
                      result.limiting_ingredient_title ===
                      ingredient.food_supply_title;
                    return (
                      <tr
                        key={ingredient.food_supply_title}
                        className={cn(
                          "border-b border-border last:border-0",
                          isLimiting && "bg-amber-50/80 dark:bg-amber-950/20",
                        )}
                        data-testid={
                          isLimiting
                            ? "stock-estimation-limiting-row"
                            : undefined
                        }
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
      )}
    </section>
  );
}

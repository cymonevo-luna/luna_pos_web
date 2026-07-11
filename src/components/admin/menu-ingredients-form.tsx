"use client";

import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import {
  getMenuIngredients,
  replaceMenuIngredients,
} from "@/lib/api/menu-ingredients";
import { ApiError } from "@/lib/api/client";
import type { FoodSupply, MenuIngredient } from "@/lib/api/types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { FoodSupplyPicker } from "@/components/admin/food-supply-picker";

interface IngredientRowState {
  key: string;
  food_supply_id: string;
  quantity_per_unit: string;
  supply: Pick<FoodSupply, "id" | "title" | "unit" | "stock_quantity"> | null;
}

interface RowErrors {
  food_supply_id?: string;
  quantity_per_unit?: string;
}

let rowKeyCounter = 0;

function createRowKey() {
  rowKeyCounter += 1;
  return `ingredient-row-${rowKeyCounter}`;
}

function ingredientToRow(ingredient: MenuIngredient): IngredientRowState {
  return {
    key: createRowKey(),
    food_supply_id: ingredient.food_supply_id,
    quantity_per_unit: String(ingredient.quantity_per_unit),
    supply: {
      id: ingredient.food_supply_id,
      title: ingredient.food_supply_title,
      unit: ingredient.food_supply_unit,
      stock_quantity: ingredient.food_supply_stock_quantity,
    },
  };
}

function createBlankRow(): IngredientRowState {
  return {
    key: createRowKey(),
    food_supply_id: "",
    quantity_per_unit: "",
    supply: null,
  };
}

function parsePositiveQuantity(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function validateRows(rows: IngredientRowState[]) {
  const rowErrors: Record<string, RowErrors> = {};
  const seen = new Map<string, number>();

  rows.forEach((row, index) => {
    const errors: RowErrors = {};

    if (!row.food_supply_id) {
      errors.food_supply_id = "Select a food supply";
    }

    const quantity = parsePositiveQuantity(row.quantity_per_unit);
    if (quantity === null) {
      errors.quantity_per_unit = "Enter a quantity greater than 0";
    }

    if (row.food_supply_id) {
      const firstIndex = seen.get(row.food_supply_id);
      if (firstIndex !== undefined) {
        errors.food_supply_id = "This food supply is already selected";
        const firstKey = rows[firstIndex]?.key;
        if (firstKey && !rowErrors[firstKey]?.food_supply_id) {
          rowErrors[firstKey] = {
            ...rowErrors[firstKey],
            food_supply_id: "This food supply is already selected",
          };
        }
      } else {
        seen.set(row.food_supply_id, index);
      }
    }

    if (Object.keys(errors).length > 0) {
      rowErrors[row.key] = errors;
    }
  });

  return rowErrors;
}

function mapServerFieldErrors(
  fields: Record<string, string>,
  rows: IngredientRowState[],
) {
  const rowErrors: Record<string, RowErrors> = {};
  let generalError: string | null = null;

  for (const [field, message] of Object.entries(fields)) {
    const match = /^ingredients(?:\[(\d+)\])?\.(.+)$/.exec(field);
    if (match) {
      const index = Number(match[1] ?? "0");
      const property = match[2];
      const row = rows[index];
      if (!row) continue;
      if (property === "food_supply_id" || property === "quantity_per_unit") {
        rowErrors[row.key] = {
          ...rowErrors[row.key],
          [property]: message,
        };
      }
      continue;
    }

    if (field === "ingredients") {
      generalError = message;
      continue;
    }

    generalError = message;
  }

  return { rowErrors, generalError };
}

export interface MenuIngredientsFormProps {
  menuId: string;
  disabled?: boolean;
}

export function MenuIngredientsForm({
  menuId,
  disabled = false,
}: MenuIngredientsFormProps) {
  const [rows, setRows] = useState<IngredientRowState[]>([]);
  const [rowErrors, setRowErrors] = useState<Record<string, RowErrors>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadIngredients = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await getMenuIngredients(menuId);
      const nextRows =
        result.data.ingredients.length > 0
          ? result.data.ingredients.map(ingredientToRow)
          : [];
      setRows(nextRows);
      setRowErrors({});
      setGeneralError(null);
    } catch (err) {
      setLoadError(
        err instanceof ApiError
          ? err.message
          : "Failed to load menu ingredients",
      );
    } finally {
      setLoading(false);
    }
  }, [menuId]);

  useEffect(() => {
    void loadIngredients();
  }, [loadIngredients]);

  const updateRow = (key: string, patch: Partial<IngredientRowState>) => {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
    setRowErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setGeneralError(null);
  };

  const handleAddRow = () => {
    setRows((current) => [...current, createBlankRow()]);
    setGeneralError(null);
  };

  const handleRemoveRow = (key: string) => {
    setRows((current) => current.filter((row) => row.key !== key));
    setRowErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setGeneralError(null);
  };

  const handleSave = async () => {
    const nextErrors = validateRows(rows);
    if (Object.keys(nextErrors).length > 0) {
      setRowErrors(nextErrors);
      setGeneralError("Fix the highlighted ingredient rows before saving.");
      return;
    }

    setSaving(true);
    setGeneralError(null);
    try {
      const payload = rows.map((row) => ({
        food_supply_id: row.food_supply_id,
        quantity_per_unit: parsePositiveQuantity(row.quantity_per_unit) as number,
      }));
      const result = await replaceMenuIngredients(menuId, payload);
      const nextRows =
        result.data.ingredients.length > 0
          ? result.data.ingredients.map(ingredientToRow)
          : [];
      setRows(nextRows);
      setRowErrors({});
      toast.success("Ingredients saved");
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        const { rowErrors: serverRowErrors, generalError: serverGeneralError } =
          mapServerFieldErrors(err.fields, rows);
        setRowErrors(serverRowErrors);
        if (serverGeneralError) {
          setGeneralError(serverGeneralError);
        }
      }
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save ingredients",
      );
    } finally {
      setSaving(false);
    }
  };

  const selectedSupplyIds = rows
    .map((row) => row.food_supply_id)
    .filter((id) => id.length > 0);

  return (
    <section
      aria-label="Menu ingredients"
      className="space-y-4 border-t border-border pt-4"
    >
      <div>
        <h4 className="text-base font-semibold">Ingredients</h4>
        <p className="text-muted-foreground text-sm">
          Define the food supplies and quantities used for one menu item.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      ) : loadError ? (
        <div className="space-y-3">
          <p className="text-destructive text-sm">{loadError}</p>
          <Button type="button" variant="outline" size="sm" onClick={loadIngredients}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No ingredients yet. Add rows to build the formula for this menu.
            </p>
          ) : (
            <div className="space-y-3">
              {rows.map((row, index) => (
                <div
                  key={row.key}
                  className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_auto]"
                >
                  <FoodSupplyPicker
                    id={`ingredient-supply-${row.key}`}
                    label={`Ingredient ${index + 1}`}
                    value={row.food_supply_id}
                    selectedSupply={row.supply}
                    excludeIds={selectedSupplyIds}
                    disabled={disabled || saving}
                    error={rowErrors[row.key]?.food_supply_id}
                    onChange={(supply) =>
                      updateRow(row.key, {
                        food_supply_id: supply.id,
                        supply: {
                          id: supply.id,
                          title: supply.title,
                          unit: supply.unit,
                          stock_quantity: supply.stock_quantity,
                        },
                      })
                    }
                  />

                  <div className="space-y-1.5">
                    <Label htmlFor={`ingredient-quantity-${row.key}`}>
                      Quantity per unit
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`ingredient-quantity-${row.key}`}
                        type="number"
                        step="any"
                        min="0"
                        inputMode="decimal"
                        value={row.quantity_per_unit}
                        disabled={disabled || saving}
                        onChange={(event) =>
                          updateRow(row.key, {
                            quantity_per_unit: event.target.value,
                          })
                        }
                      />
                      <span className="text-muted-foreground min-w-12 text-sm">
                        {row.supply?.unit ?? "—"}
                      </span>
                    </div>
                    {rowErrors[row.key]?.quantity_per_unit && (
                      <p className="text-destructive text-sm">
                        {rowErrors[row.key]?.quantity_per_unit}
                      </p>
                    )}
                  </div>

                  <div className="flex items-end justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive h-11 w-11"
                      aria-label={`Remove ingredient ${index + 1}`}
                      disabled={disabled || saving}
                      onClick={() => handleRemoveRow(row.key)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {generalError && (
            <p className="text-destructive text-sm">{generalError}</p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handleAddRow}
              disabled={disabled || saving}
            >
              <Plus className="h-4 w-4" />
              Add ingredient
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              isLoading={saving}
              disabled={disabled || loading}
            >
              Save ingredients
            </Button>
          </div>

          <p className="text-muted-foreground text-xs">
            Need a new supply?{" "}
            <Link href="/admin/food-supplies" className="font-medium underline">
              Manage food supplies
            </Link>
          </p>
        </>
      )}
    </section>
  );
}

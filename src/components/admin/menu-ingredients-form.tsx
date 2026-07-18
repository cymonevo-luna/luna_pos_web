"use client";

import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import {
  getMenuIngredients,
  replaceMenuIngredients,
} from "@/lib/api/menu-ingredients";
import { foodSuppliesAdminApi } from "@/lib/api/food-supplies";
import { ApiError } from "@/lib/api/client";
import type { CookingMeasurement, FoodSupply, Menu } from "@/lib/api/types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FoodSupplyPicker } from "@/components/admin/food-supply-picker";
import { MenuPicker } from "@/components/admin/menu-picker";
import {
  MenuFormulaIngredientQuantityHelp,
  MenuFormulaPerPortionPreview,
} from "@/components/admin/menu-formula-ingredient-quantity";
import {
  BASE_UNIT_SELECTION,
  buildUnitOptions,
  computeBaseQuantityHint,
  getSelectedUnitLabel,
  hasCookingUnitOptions,
} from "@/lib/menu-ingredient-units";
import {
  createBlankRow,
  ingredientToRow,
  mapServerFieldErrors,
  type IngredientLineType,
  type IngredientRowState,
  type RowErrors,
  rowToPayload,
  validateRows,
} from "@/lib/menu-ingredient-form";
import { MENU_COGS_DEFAULTS } from "@/lib/menu-cogs";
import { getUnitLabel } from "@/lib/units";

const LINE_TYPE_OPTIONS = [
  { value: "food_supply", label: "Food supply" },
  { value: "menu", label: "Menu" },
];

async function loadCookingMeasurementsForSupply(supplyId: string) {
  const result = await foodSuppliesAdminApi.get(supplyId);
  return result.data.cooking_measurements;
}

export interface MenuIngredientsFormProps {
  menuId: string;
  recipeYield?: number;
  disabled?: boolean;
}

export function MenuIngredientsForm({
  menuId,
  recipeYield = MENU_COGS_DEFAULTS.recipe_yield,
  disabled = false,
}: MenuIngredientsFormProps) {
  const [rows, setRows] = useState<IngredientRowState[]>([]);
  const [rowErrors, setRowErrors] = useState<Record<string, RowErrors>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const hydrateRowCookingMeasurements = useCallback(
    async (rowKey: string, supplyId: string, fallback?: CookingMeasurement[]) => {
      if (fallback && fallback.length > 0) {
        setRows((current) =>
          current.map((row) =>
            row.key === rowKey && row.food_supply_id === supplyId
              ? { ...row, cooking_measurements: fallback }
              : row,
          ),
        );
      }

      try {
        const measurements = await loadCookingMeasurementsForSupply(supplyId);
        setRows((current) =>
          current.map((row) =>
            row.key === rowKey && row.food_supply_id === supplyId
              ? { ...row, cooking_measurements: measurements }
              : row,
          ),
        );
      } catch {
        if (!fallback?.length) {
          return;
        }
      }
    },
    [],
  );

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

      const uniqueSupplyIds = [
        ...new Set(
          nextRows
            .filter((row) => row.line_type === "food_supply")
            .map((row) => row.food_supply_id)
            .filter(Boolean),
        ),
      ];
      await Promise.all(
        uniqueSupplyIds.map(async (supplyId) => {
          const row = nextRows.find((item) => item.food_supply_id === supplyId);
          if (!row) return;
          await hydrateRowCookingMeasurements(row.key, supplyId);
        }),
      );
    } catch (err) {
      setLoadError(
        err instanceof ApiError
          ? err.message
          : "Failed to load menu ingredients",
      );
    } finally {
      setLoading(false);
    }
  }, [hydrateRowCookingMeasurements, menuId]);

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

  const handleAddRow = (lineType: IngredientLineType = "food_supply") => {
    setRows((current) => [...current, createBlankRow(lineType)]);
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

  const handleLineTypeChange = (rowKey: string, lineType: IngredientLineType) => {
    updateRow(rowKey, {
      line_type: lineType,
      food_supply_id: "",
      unit_selection: BASE_UNIT_SELECTION,
      cooking_measurements: [],
      supply: null,
      ingredient_menu_id: "",
      menu: null,
      quantity: "",
    });
  };

  const handleSupplyChange = (rowKey: string, supply: FoodSupply) => {
    updateRow(rowKey, {
      food_supply_id: supply.id,
      unit_selection: BASE_UNIT_SELECTION,
      cooking_measurements: supply.cooking_measurements,
      supply: {
        id: supply.id,
        title: supply.title,
        unit: supply.unit,
        stock_quantity: supply.stock_quantity,
      },
    });
    void hydrateRowCookingMeasurements(
      rowKey,
      supply.id,
      supply.cooking_measurements,
    );
  };

  const handleMenuChange = (rowKey: string, menu: Menu) => {
    updateRow(rowKey, {
      ingredient_menu_id: menu.id,
      menu: {
        id: menu.id,
        title: menu.title,
        category_name: menu.category_name,
      },
    });
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
      const payload = rows.map(rowToPayload);
      const result = await replaceMenuIngredients(menuId, payload);
      const nextRows =
        result.data.ingredients.length > 0
          ? result.data.ingredients.map(ingredientToRow)
          : [];
      setRows(nextRows);
      setRowErrors({});

      const uniqueSupplyIds = [
        ...new Set(
          nextRows
            .filter((row) => row.line_type === "food_supply")
            .map((row) => row.food_supply_id)
            .filter(Boolean),
        ),
      ];
      await Promise.all(
        uniqueSupplyIds.map(async (supplyId) => {
          const row = nextRows.find((item) => item.food_supply_id === supplyId);
          if (!row) return;
          await hydrateRowCookingMeasurements(row.key, supplyId);
        }),
      );

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
    .filter((row) => row.line_type === "food_supply")
    .map((row) => row.food_supply_id)
    .filter((id) => id.length > 0);

  const selectedMenuIds = rows
    .filter((row) => row.line_type === "menu")
    .map((row) => row.ingredient_menu_id)
    .filter((id) => id.length > 0);

  const menuExcludeIds = [menuId, ...selectedMenuIds];

  return (
    <section
      aria-label="Menu ingredients"
      className="space-y-4 border-t border-border pt-4"
    >
      <div>
        <h4 className="text-base font-semibold">Ingredients</h4>
        <p className="text-muted-foreground text-sm">
          Define the food supplies, sub-recipe menus, and quantities used for one
          menu item.
        </p>
        <MenuFormulaIngredientQuantityHelp />
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
              {rows.map((row, index) => {
                const baseUnit = row.supply?.unit;
                const unitOptions =
                  row.line_type === "food_supply" &&
                  baseUnit &&
                  hasCookingUnitOptions(row.cooking_measurements)
                    ? buildUnitOptions(baseUnit, row.cooking_measurements)
                    : [];
                const selectedUnitLabel =
                  row.line_type === "menu"
                    ? "portions"
                    : baseUnit != null
                      ? getSelectedUnitLabel(
                          row.unit_selection,
                          baseUnit,
                          row.cooking_measurements,
                        )
                      : "—";
                const parsedQuantity = Number(row.quantity);
                const baseQuantityHint =
                  row.line_type === "food_supply" &&
                  baseUnit != null &&
                  Number.isFinite(parsedQuantity) &&
                  parsedQuantity > 0
                    ? computeBaseQuantityHint(
                        parsedQuantity,
                        row.unit_selection,
                        row.cooking_measurements,
                        baseUnit,
                      )
                    : null;
                const quantityLabel =
                  row.line_type === "menu"
                    ? "Quantity (portions)"
                    : "Quantity per unit";

                return (
                  <div
                    key={row.key}
                    className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto]"
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor={`ingredient-type-${row.key}`}>
                        Line type
                      </Label>
                      <Select
                        id={`ingredient-type-${row.key}`}
                        aria-label={`Line type for ingredient ${index + 1}`}
                        value={row.line_type}
                        disabled={disabled || saving}
                        options={LINE_TYPE_OPTIONS}
                        onChange={(event) =>
                          handleLineTypeChange(
                            row.key,
                            event.target.value as IngredientLineType,
                          )
                        }
                      />
                    </div>

                    {row.line_type === "food_supply" ? (
                      <FoodSupplyPicker
                        id={`ingredient-supply-${row.key}`}
                        label={`Ingredient ${index + 1}`}
                        value={row.food_supply_id}
                        selectedSupply={row.supply}
                        excludeIds={selectedSupplyIds}
                        disabled={disabled || saving}
                        error={rowErrors[row.key]?.food_supply_id}
                        onChange={(supply) => handleSupplyChange(row.key, supply)}
                      />
                    ) : (
                      <div className="space-y-1.5">
                        <MenuPicker
                          id={`ingredient-menu-${row.key}`}
                          label={`Ingredient ${index + 1}`}
                          value={row.ingredient_menu_id}
                          selectedMenu={row.menu}
                          excludeIds={menuExcludeIds}
                          disabled={disabled || saving}
                          error={rowErrors[row.key]?.ingredient_menu_id}
                          onChange={(menu) => handleMenuChange(row.key, menu)}
                        />
                        {row.ingredient_menu_id && row.menu?.title && (
                          <p className="text-muted-foreground text-xs">
                            <Link
                              href={`/admin/menus/${row.ingredient_menu_id}/ingredients`}
                              className="font-medium underline"
                            >
                              {row.menu.title}
                            </Link>{" "}
                            sub-recipe ingredients
                          </p>
                        )}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor={`ingredient-quantity-${row.key}`}>
                        {quantityLabel}
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id={`ingredient-quantity-${row.key}`}
                          type="number"
                          step="any"
                          min="0"
                          inputMode="decimal"
                          value={row.quantity}
                          disabled={disabled || saving}
                          onChange={(event) =>
                            updateRow(row.key, {
                              quantity: event.target.value,
                            })
                          }
                        />
                        {unitOptions.length > 0 ? (
                          <Select
                            aria-label={`Unit for ingredient ${index + 1}`}
                            className="min-w-28"
                            value={row.unit_selection}
                            disabled={disabled || saving}
                            options={unitOptions}
                            onChange={(event) =>
                              updateRow(row.key, {
                                unit_selection: event.target.value,
                              })
                            }
                          />
                        ) : row.line_type === "food_supply" ? (
                          <span className="text-muted-foreground min-w-12 text-sm">
                            {baseUnit ? getUnitLabel(baseUnit) : "—"}
                          </span>
                        ) : null}
                      </div>
                      {baseQuantityHint && (
                        <p
                          className="text-muted-foreground text-xs"
                          data-testid={`base-quantity-hint-${row.key}`}
                        >
                          {baseQuantityHint}
                        </p>
                      )}
                      {rowErrors[row.key]?.quantity_per_unit && (
                        <p className="text-destructive text-sm">
                          {rowErrors[row.key]?.quantity_per_unit}
                        </p>
                      )}
                      <MenuFormulaPerPortionPreview
                        quantity={parsedQuantity}
                        unit={selectedUnitLabel}
                        recipeYield={recipeYield}
                      />
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
                );
              })}
            </div>
          )}

          {generalError && (
            <p className="text-destructive text-sm">{generalError}</p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleAddRow("food_supply")}
                disabled={disabled || saving}
              >
                <Plus className="h-4 w-4" />
                Add food supply
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleAddRow("menu")}
                disabled={disabled || saving}
              >
                <Plus className="h-4 w-4" />
                Add menu reference
              </Button>
            </div>
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

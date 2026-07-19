"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  menusAdminApi,
  menuFullFormToPayload,
  normalizeMenuPhotoFormValue,
} from "@/lib/api/menus";
import { ApiError } from "@/lib/api/client";
import type { Menu } from "@/lib/api/types";
import type { MenuBasicFormValues, MenuCogsFormValues } from "@/lib/validations";
import { MENU_COGS_DEFAULTS } from "@/lib/menu-cogs";
import { toast } from "sonner";
import {
  MenuCogsForm,
  type MenuCogsFormHandle,
} from "@/components/admin/menu-cogs-form";
import { MenuIngredientsForm } from "@/components/admin/menu-ingredients-form";
import { MenuStockEstimationPanel } from "@/components/admin/menu-stock-estimation-panel";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function menuToBasicFormValues(menu: Menu): MenuBasicFormValues {
  return {
    title: menu.title,
    description: menu.description ?? "",
    category_id: menu.category_id,
    photo_url: normalizeMenuPhotoFormValue(menu.photo_url),
    available_stock: menu.available_stock,
    sell_price: menu.sell_price,
  };
}

function menuToCogsValues(menu: Menu): MenuCogsFormValues {
  return {
    recipe_yield: menu.recipe_yield ?? MENU_COGS_DEFAULTS.recipe_yield,
    margin_percent: menu.margin_percent ?? MENU_COGS_DEFAULTS.margin_percent,
    vat_percent: menu.vat_percent ?? MENU_COGS_DEFAULTS.vat_percent,
  };
}

export function AdminMenuIngredientsContent({ id }: { id: string }) {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recipeYield, setRecipeYield] = useState<number>(
    MENU_COGS_DEFAULTS.recipe_yield,
  );
  const [savingCogs, setSavingCogs] = useState(false);
  const cogsFormRef = useRef<MenuCogsFormHandle>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await menusAdminApi.get(id);
      setMenu(res.data);
      setRecipeYield(
        res.data.recipe_yield ?? MENU_COGS_DEFAULTS.recipe_yield,
      );
    } catch (err) {
      setMenu(null);
      if (err instanceof ApiError && err.status === 404) {
        setError("Menu not found.");
      } else {
        setError(
          err instanceof ApiError ? err.message : "Failed to load menu",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCogsSubmit = async (values: MenuCogsFormValues) => {
    if (!menu) return;
    setSavingCogs(true);
    try {
      const payload = menuFullFormToPayload(
        menuToBasicFormValues(menu),
        values,
      );
      const res = await menusAdminApi.update(menu.id, payload);
      setMenu(res.data);
      setRecipeYield(values.recipe_yield);
      toast.success("COGS settings saved");
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        cogsFormRef.current?.applyServerErrors(err.fields);
      }
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save COGS settings",
      );
    } finally {
      setSavingCogs(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        href="/admin/menus"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to menus
      </Link>

      {loading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="space-y-4 py-10 text-center">
            <p className="text-destructive">{error}</p>
            <Link
              href="/admin/menus"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Back to menus
            </Link>
          </CardContent>
        </Card>
      ) : menu ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Ingredients — {menu.title}</CardTitle>
              <CardDescription>{menu.category_name}</CardDescription>
            </CardHeader>
          </Card>

          <section aria-label="COGS settings" className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold">COGS settings</h3>
              <p className="text-muted-foreground text-sm">
                Configure recipe yield, margin, and VAT for this menu.
              </p>
            </div>
            <Card className="p-4">
              <MenuCogsForm
                ref={cogsFormRef}
                defaultValues={menuToCogsValues(menu)}
                onSubmit={handleCogsSubmit}
                isLoading={savingCogs}
              />
            </Card>
          </section>

          <Card className="p-4">
            <MenuIngredientsForm menuId={menu.id} recipeYield={recipeYield} />
            <MenuStockEstimationPanel menuId={menu.id} />
          </Card>
        </>
      ) : null}
    </div>
  );
}

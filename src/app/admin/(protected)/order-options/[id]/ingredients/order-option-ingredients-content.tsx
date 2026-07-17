"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { orderOptionsAdminApi } from "@/lib/api/order-options";
import { ApiError } from "@/lib/api/client";
import type { OrderOption } from "@/lib/api/types";
import { OrderOptionIngredientsForm } from "@/components/admin/order-option-ingredients-form";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AdminOrderOptionIngredientsContent({ id }: { id: string }) {
  const [orderOption, setOrderOption] = useState<OrderOption | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await orderOptionsAdminApi.get(id);
      setOrderOption(res.data);
    } catch (err) {
      setOrderOption(null);
      if (err instanceof ApiError && err.status === 404) {
        setError("Order option not found.");
      } else {
        setError(
          err instanceof ApiError
            ? err.message
            : "Failed to load order option",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/order-options"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to order options
      </Link>

      {loading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="space-y-4 py-10 text-center">
            <p className="text-destructive">{error}</p>
            <Link
              href="/admin/order-options"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Back to order options
            </Link>
          </CardContent>
        </Card>
      ) : orderOption ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Ingredients — {orderOption.name}</CardTitle>
              <CardDescription>
                Configure food supplies consumed per order for this option.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="p-4">
            <OrderOptionIngredientsForm orderOptionId={orderOption.id} />
          </Card>
        </>
      ) : null}
    </div>
  );
}

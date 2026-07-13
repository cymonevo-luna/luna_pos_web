"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  productionRequestsAdminApi,
  productionRequestFormToPayload,
} from "@/lib/api/production-requests";
import { ApiError } from "@/lib/api/client";
import type {
  ProductionAggregatedIngredient,
  ProductionRequest,
  ProductionRequestItem,
  ProductionRequestStatus,
  ProductionRequestStatusHistoryEntry,
  ProductionStockEstimationIngredient,
} from "@/lib/api/types";
import { formatDateTime, formatStockQuantity } from "@/lib/utils";
import { toast } from "sonner";
import { ProductionRequestForm } from "@/components/admin/production-request-form";
import type { ProductionRequestFormValues } from "@/lib/validations";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

function productionStatusBadgeVariant(
  status: ProductionRequestStatus,
): NonNullable<BadgeProps["variant"]> {
  switch (status) {
    case "REQUESTED":
      return "default";
    case "ACCEPTED":
      return "warning";
    case "READY_TO_PICK":
      return "secondary";
    case "DONE":
      return "success";
    default:
      return "secondary";
  }
}

function formatStatusHistoryLabel(entry: ProductionRequestStatusHistoryEntry) {
  if (entry.from_status?.trim()) {
    return `${entry.from_status} → ${entry.to_status}`;
  }
  return entry.to_status;
}

function formatQuantity(quantity: number, unit: string) {
  return formatStockQuantity(quantity, unit);
}

function AggregatedIngredientsTable({
  ingredients,
}: {
  ingredients: ProductionAggregatedIngredient[];
}) {
  if (ingredients.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No ingredient requirements calculated for this request.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Food supply</th>
            <th className="px-4 py-3 font-medium">Required</th>
            <th className="px-4 py-3 font-medium">Current stock</th>
            <th className="px-4 py-3 font-medium">Remaining</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {ingredients.map((ingredient) => (
            <tr
              key={ingredient.food_supply_id}
              className="border-b border-border last:border-0"
            >
              <td className="px-4 py-3 font-medium">
                {ingredient.food_supply_title}
              </td>
              <td className="px-4 py-3">
                {formatQuantity(ingredient.required_quantity, ingredient.unit)}
              </td>
              <td className="px-4 py-3">
                {formatQuantity(
                  ingredient.current_stock_quantity,
                  ingredient.unit,
                )}
              </td>
              <td
                className={cn(
                  "px-4 py-3",
                  ingredient.remaining_after < 0 &&
                    "text-destructive font-medium",
                )}
              >
                {formatQuantity(ingredient.remaining_after, ingredient.unit)}
              </td>
              <td className="px-4 py-3">
                <Badge
                  variant={ingredient.is_sufficient ? "success" : "destructive"}
                >
                  {ingredient.is_sufficient ? "OK" : "Low"}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LineStockEstimationTable({
  item,
}: {
  item: ProductionRequestItem;
}) {
  const estimation = item.stock_estimation;

  if (!estimation.has_formula) {
    return (
      <p className="text-sm text-muted-foreground">
        {estimation.message ||
          "No ingredient formula saved for this menu."}
      </p>
    );
  }

  if (estimation.ingredients.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No ingredient breakdown available.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={estimation.is_fully_producible ? "success" : "destructive"}
        >
          {estimation.is_fully_producible ? "Sufficient" : "Insufficient"}
        </Badge>
        {estimation.limiting_ingredient_title ? (
          <p className="text-sm text-muted-foreground">
            Limiting:{" "}
            <span className="font-medium">
              {estimation.limiting_ingredient_title}
            </span>
          </p>
        ) : null}
      </div>
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
            {estimation.ingredients.map(
              (ingredient: ProductionStockEstimationIngredient) => {
                const isLimiting =
                  estimation.limiting_ingredient_title ===
                  ingredient.food_supply_title;
                return (
                  <tr
                    key={ingredient.food_supply_id}
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
              },
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ProductionRequestDetailContent({ id }: { id: string }) {
  const [request, setRequest] = useState<ProductionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [readyingPick, setReadyingPick] = useState(false);
  const [statusActionError, setStatusActionError] = useState<string | null>(
    null,
  );
  const [togglingItemId, setTogglingItemId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await productionRequestsAdminApi.get(id);
      setRequest(res.data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to load production request",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async (values: ProductionRequestFormValues) => {
    setSaving(true);
    try {
      await productionRequestsAdminApi.update(
        id,
        productionRequestFormToPayload(values),
      );
      await load();
      toast.success("Production request updated");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to update request";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    setStatusActionError(null);
    try {
      await productionRequestsAdminApi.updateStatus(id, "ACCEPTED");
      await load();
      toast.success("Production request approved");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to approve production request";
      setStatusActionError(message);
      if (err instanceof ApiError && err.status === 422) {
        toast.error(message);
      } else {
        toast.error(message);
      }
    } finally {
      setApproving(false);
    }
  };

  const handleReadyToPick = async () => {
    setReadyingPick(true);
    setStatusActionError(null);
    try {
      await productionRequestsAdminApi.updateStatus(id, "READY_TO_PICK");
      await load();
      toast.success("Production request is ready to pick");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to mark request as ready to pick";
      setStatusActionError(message);
      toast.error(message);
    } finally {
      setReadyingPick(false);
    }
  };

  const handleToggleFinished = async (item: ProductionRequestItem) => {
    setTogglingItemId(item.id);
    try {
      await productionRequestsAdminApi.markItemFinished(
        id,
        item.id,
        !item.is_finished,
      );
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to update item status",
      );
    } finally {
      setTogglingItemId(null);
    }
  };

  const allItemsFinished =
    request?.items.every((item) => item.is_finished) ?? false;
  const unfinishedCount =
    request?.items.filter((item) => !item.is_finished).length ?? 0;

  const formDefaultValues: Partial<ProductionRequestFormValues> | undefined =
    request
      ? {
          items: request.items.map((item) => ({
            menu_id: item.menu_id,
            quantity: item.quantity,
          })),
          notes: request.notes ?? "",
        }
      : undefined;

  const menuOptions =
    request?.items.map((item) => ({
      id: item.menu_id,
      title: item.menu_title,
      category_name: "",
    })) ?? [];

  return (
    <div className="max-w-4xl space-y-6">
      <Link
        href="/admin/production-requests"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to production requests
      </Link>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-48 w-full" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : request ? (
        <>
          <div>
            <h2 className="text-2xl font-semibold">Production request</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-mono">{request.id}</span>
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card data-testid="production-status-card">
              <CardHeader className="pb-2">
                <CardDescription>Status</CardDescription>
                <CardTitle className="text-xl">
                  <Badge variant={productionStatusBadgeVariant(request.status)}>
                    {request.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Stock Available</CardDescription>
                <CardTitle className="text-xl">
                  <Badge
                    variant={
                      request.is_fully_producible ? "success" : "destructive"
                    }
                  >
                    {request.is_fully_producible ? "Yes" : "No"}
                  </Badge>
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Created at</CardDescription>
                <CardTitle className="text-xl">
                  {formatDateTime(request.created_at)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Created by</CardDescription>
                <CardTitle className="text-xl">
                  {request.created_by_username?.trim() || "—"}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {request.status === "READY_TO_PICK" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Awaiting delivery</CardTitle>
                <CardDescription>
                  This production request is ready for cashier pickup and
                  delivery to the customer.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          {request.status === "REQUESTED" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Edit request</CardTitle>
                <CardDescription>
                  Update line items and notes before approving this request.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ProductionRequestForm
                  key={request.updated_at}
                  defaultValues={formDefaultValues}
                  preloadedMenus={menuOptions}
                  onSubmit={handleSave}
                  isLoading={saving}
                  submitLabel="Save changes"
                  showCancel={false}
                />
                <div className="border-t border-border pt-4 space-y-3">
                  <div>
                    <h4 className="text-base font-semibold">Approve request</h4>
                    <p className="text-muted-foreground text-sm">
                      Approving deducts required ingredients from food supply
                      stock. This cannot be undone from this screen.
                    </p>
                  </div>
                  <Button
                    onClick={() => void handleApprove()}
                    isLoading={approving}
                    disabled={approving || saving}
                    aria-label="Approve to ACCEPTED"
                  >
                    Approve to ACCEPTED
                  </Button>
                  {statusActionError ? (
                    <p className="text-sm text-destructive" role="alert">
                      {statusActionError}
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {request.status === "ACCEPTED" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Production progress</CardTitle>
                <CardDescription>
                  Mark each line item finished when production is complete.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={() => void handleReadyToPick()}
                  isLoading={readyingPick}
                  disabled={!allItemsFinished || readyingPick}
                  aria-label="Ready to pick"
                >
                  Ready to pick
                </Button>
                {!allItemsFinished ? (
                  <p className="text-sm text-muted-foreground" role="status">
                    {unfinishedCount} item
                    {unfinishedCount === 1 ? "" : "s"} still need to be marked
                    finished before this request can advance.
                  </p>
                ) : null}
                {statusActionError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {statusActionError}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {request.notes?.trim() && request.status !== "REQUESTED" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{request.notes}</p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status History</CardTitle>
              <CardDescription>
                Chronological record of status changes for this production
                request.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {request.status_history.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No status history yet
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {request.status_history.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="space-y-1">
                        <Badge
                          variant={productionStatusBadgeVariant(entry.to_status)}
                        >
                          {formatStatusHistoryLabel(entry)}
                        </Badge>
                        <p className="text-sm text-muted-foreground">
                          {entry.changed_by_username}
                        </p>
                      </div>
                      <time
                        className="text-sm text-muted-foreground"
                        dateTime={entry.created_at}
                      >
                        {formatDateTime(entry.created_at)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Aggregated ingredients</CardTitle>
              <CardDescription>
                Total food supply requirements across all line items.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AggregatedIngredientsTable
                ingredients={request.aggregated_ingredients}
              />
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">Line items</CardTitle>
              <CardDescription>
                {request.items.length} item
                {request.items.length === 1 ? "" : "s"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {request.items.map((item) => (
                <div
                  key={item.id}
                  className="space-y-4 border-b border-border pb-6 last:border-0 last:pb-0"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="font-medium">{item.menu_title}</h4>
                      <p className="text-sm text-muted-foreground">
                        Quantity: {item.quantity}
                      </p>
                    </div>
                    {request.status === "ACCEPTED" ? (
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={item.is_finished}
                          disabled={togglingItemId === item.id}
                          onChange={() => void handleToggleFinished(item)}
                          aria-label={`Mark ${item.menu_title} finished`}
                        />
                        Mark finished
                      </label>
                    ) : item.is_finished ? (
                      <Badge variant="success">Finished</Badge>
                    ) : null}
                  </div>
                  <LineStockEstimationTable item={item} />
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

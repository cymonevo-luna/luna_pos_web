import { describe, it, expect, vi } from "vitest";
import type { OrderOption } from "@/lib/api/types";
import {
  orderOptionsToIds,
  handleOrderOptionDragEnd,
  reorderOrderOptions,
} from "./order-option-reorder";

const makeOrderOption = (
  id: string,
  name: string,
  priority: number,
  ingredientCount = 0,
): OrderOption => ({
  id,
  name,
  priority,
  ingredient_count: ingredientCount,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
});

describe("reorderOrderOptions", () => {
  const orderOptions = [
    makeOrderOption("opt-1", "Take Away", 5),
    makeOrderOption("opt-2", "Box", 10),
    makeOrderOption("opt-3", "Dine-In", 3),
  ];

  it("moves the active option before the over target", () => {
    const reordered = reorderOrderOptions(orderOptions, "opt-2", "opt-1");
    expect(orderOptionsToIds(reordered!)).toEqual(["opt-2", "opt-1", "opt-3"]);
  });

  it("returns null when active and over are the same", () => {
    expect(reorderOrderOptions(orderOptions, "opt-2", "opt-2")).toBeNull();
  });

  it("returns null when over is undefined", () => {
    expect(reorderOrderOptions(orderOptions, "opt-2", undefined)).toBeNull();
  });
});

describe("handleOrderOptionDragEnd", () => {
  const orderOptions = [
    makeOrderOption("opt-1", "Take Away", 5),
    makeOrderOption("opt-2", "Box", 10),
    makeOrderOption("opt-3", "Dine-In", 3),
  ];

  it("calls reorder with the new top-to-bottom order and reloads on success", async () => {
    const setOrderOptions = vi.fn();
    const reorder = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const reload = vi.fn();

    await handleOrderOptionDragEnd(
      {
        active: { id: "opt-2" },
        over: { id: "opt-1" },
      } as never,
      {
        orderOptions,
        setOrderOptions,
        reorder,
        onSuccess,
        onError,
        reload,
      },
    );

    expect(setOrderOptions).toHaveBeenNthCalledWith(1, [
      makeOrderOption("opt-2", "Box", 10),
      makeOrderOption("opt-1", "Take Away", 5),
      makeOrderOption("opt-3", "Dine-In", 3),
    ]);
    expect(reorder).toHaveBeenCalledWith(["opt-2", "opt-1", "opt-3"]);
    expect(onSuccess).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("reverts order and reports the error when reorder fails", async () => {
    const setOrderOptions = vi.fn();
    const reorder = vi.fn().mockRejectedValue(new Error("Reorder failed"));
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const reload = vi.fn();

    await handleOrderOptionDragEnd(
      {
        active: { id: "opt-2" },
        over: { id: "opt-1" },
      } as never,
      {
        orderOptions,
        setOrderOptions,
        reorder,
        onSuccess,
        onError,
        reload,
      },
    );

    expect(setOrderOptions).toHaveBeenNthCalledWith(2, orderOptions);
    expect(onError).toHaveBeenCalledWith("Reorder failed");
    expect(onSuccess).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});

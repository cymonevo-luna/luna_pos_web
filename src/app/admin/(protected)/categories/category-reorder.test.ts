import { describe, it, expect, vi } from "vitest";
import type { Category } from "@/lib/api/types";
import {
  categoriesToIds,
  handleCategoryDragEnd,
  reorderCategories,
} from "./category-reorder";

const makeCategory = (id: string, name: string, priority: number): Category => ({
  id,
  name,
  priority,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
});

describe("reorderCategories", () => {
  const categories = [
    makeCategory("cat-1", "First", 0),
    makeCategory("cat-2", "Second", 1),
    makeCategory("cat-3", "Third", 2),
  ];

  it("moves the active category before the over target", () => {
    const reordered = reorderCategories(categories, "cat-2", "cat-1");
    expect(categoriesToIds(reordered!)).toEqual(["cat-2", "cat-1", "cat-3"]);
  });

  it("returns null when active and over are the same", () => {
    expect(reorderCategories(categories, "cat-2", "cat-2")).toBeNull();
  });

  it("returns null when over is undefined", () => {
    expect(reorderCategories(categories, "cat-2", undefined)).toBeNull();
  });
});

describe("handleCategoryDragEnd", () => {
  const categories = [
    makeCategory("cat-1", "First", 0),
    makeCategory("cat-2", "Second", 1),
    makeCategory("cat-3", "Third", 2),
  ];

  it("calls reorder with the new top-to-bottom order and reloads on success", async () => {
    const setCategories = vi.fn();
    const reorder = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const reload = vi.fn();

    await handleCategoryDragEnd(
      {
        active: { id: "cat-2" },
        over: { id: "cat-1" },
      } as never,
      {
        categories,
        setCategories,
        reorder,
        onSuccess,
        onError,
        reload,
      },
    );

    expect(setCategories).toHaveBeenNthCalledWith(1, [
      makeCategory("cat-2", "Second", 1),
      makeCategory("cat-1", "First", 0),
      makeCategory("cat-3", "Third", 2),
    ]);
    expect(reorder).toHaveBeenCalledWith(["cat-2", "cat-1", "cat-3"]);
    expect(onSuccess).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("reverts order and reports the error when reorder fails", async () => {
    const setCategories = vi.fn();
    const reorder = vi.fn().mockRejectedValue(new Error("Reorder failed"));
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const reload = vi.fn();

    await handleCategoryDragEnd(
      {
        active: { id: "cat-2" },
        over: { id: "cat-1" },
      } as never,
      {
        categories,
        setCategories,
        reorder,
        onSuccess,
        onError,
        reload,
      },
    );

    expect(setCategories).toHaveBeenNthCalledWith(1, [
      makeCategory("cat-2", "Second", 1),
      makeCategory("cat-1", "First", 0),
      makeCategory("cat-3", "Third", 2),
    ]);
    expect(setCategories).toHaveBeenNthCalledWith(2, categories);
    expect(onError).toHaveBeenCalledWith("Reorder failed");
    expect(onSuccess).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});

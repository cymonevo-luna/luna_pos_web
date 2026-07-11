import { arrayMove } from "@dnd-kit/sortable";
import type { DragEndEvent } from "@dnd-kit/core";
import type { Category } from "@/lib/api/types";

export function reorderCategories(
  categories: Category[],
  activeId: string,
  overId: string | undefined,
): Category[] | null {
  if (!overId || activeId === overId) return null;

  const oldIndex = categories.findIndex((category) => category.id === activeId);
  const newIndex = categories.findIndex((category) => category.id === overId);
  if (oldIndex === -1 || newIndex === -1) return null;

  return arrayMove(categories, oldIndex, newIndex);
}

export function categoriesToIds(categories: Category[]): string[] {
  return categories.map((category) => category.id);
}

export interface CategoryReorderDeps {
  categories: Category[];
  setCategories: (categories: Category[]) => void;
  reorder: (categoryIds: string[]) => Promise<unknown>;
  onSuccess: () => void;
  onError: (message: string) => void;
  reload: () => void;
}

export async function handleCategoryDragEnd(
  event: DragEndEvent,
  deps: CategoryReorderDeps,
): Promise<void> {
  const { active, over } = event;
  if (!over) return;

  const reordered = reorderCategories(
    deps.categories,
    String(active.id),
    String(over.id),
  );
  if (!reordered) return;

  const previous = deps.categories;
  deps.setCategories(reordered);

  try {
    await deps.reorder(categoriesToIds(reordered));
    deps.onSuccess();
    deps.reload();
  } catch (err) {
    deps.setCategories(previous);
    deps.onError(
      err instanceof Error ? err.message : "Failed to save category order",
    );
  }
}

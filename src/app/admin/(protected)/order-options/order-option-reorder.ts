import { arrayMove } from "@dnd-kit/sortable";
import type { DragEndEvent } from "@dnd-kit/core";
import type { OrderOption } from "@/lib/api/types";

export function reorderOrderOptions(
  orderOptions: OrderOption[],
  activeId: string,
  overId: string | undefined,
): OrderOption[] | null {
  if (!overId || activeId === overId) return null;

  const oldIndex = orderOptions.findIndex((option) => option.id === activeId);
  const newIndex = orderOptions.findIndex((option) => option.id === overId);
  if (oldIndex === -1 || newIndex === -1) return null;

  return arrayMove(orderOptions, oldIndex, newIndex);
}

export function orderOptionsToIds(orderOptions: OrderOption[]): string[] {
  return orderOptions.map((option) => option.id);
}

export interface OrderOptionReorderDeps {
  orderOptions: OrderOption[];
  setOrderOptions: (orderOptions: OrderOption[]) => void;
  reorder: (orderOptionIds: string[]) => Promise<unknown>;
  onSuccess: () => void;
  onError: (message: string) => void;
  reload: () => void;
}

export async function handleOrderOptionDragEnd(
  event: DragEndEvent,
  deps: OrderOptionReorderDeps,
): Promise<void> {
  const { active, over } = event;
  if (!over) return;

  const reordered = reorderOrderOptions(
    deps.orderOptions,
    String(active.id),
    String(over.id),
  );
  if (!reordered) return;

  const previous = deps.orderOptions;
  deps.setOrderOptions(reordered);

  try {
    await deps.reorder(orderOptionsToIds(reordered));
    deps.onSuccess();
    deps.reload();
  } catch (err) {
    deps.setOrderOptions(previous);
    deps.onError(
      err instanceof Error ? err.message : "Failed to save order option order",
    );
  }
}

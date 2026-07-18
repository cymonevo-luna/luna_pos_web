"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  FoodSupplySortBy,
  FoodSupplySortOrder,
} from "@/lib/api/food-supplies";

interface SortableTableHeaderProps {
  label: string;
  sortKey: FoodSupplySortBy;
  activeSortBy?: FoodSupplySortBy;
  activeSortOrder?: FoodSupplySortOrder;
  onSort: (sortKey: FoodSupplySortBy) => void;
  className?: string;
}

export function SortableTableHeader({
  label,
  sortKey,
  activeSortBy,
  activeSortOrder,
  onSort,
  className,
}: SortableTableHeaderProps) {
  const isActive = activeSortBy === sortKey;
  const Icon = !isActive
    ? ArrowUpDown
    : activeSortOrder === "asc"
      ? ArrowUp
      : ArrowDown;
  const sortDirectionLabel = isActive
    ? activeSortOrder === "asc"
      ? "ascending"
      : "descending"
    : null;
  const ariaLabel = sortDirectionLabel
    ? `Sort by ${label.toLowerCase()} ${sortDirectionLabel}`
    : `Sort by ${label.toLowerCase()}`;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "-ml-2 h-8 gap-1.5 px-2 font-medium text-muted-foreground hover:text-foreground",
        className,
      )}
      aria-label={ariaLabel}
      onClick={() => onSort(sortKey)}
    >
      {label}
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
    </Button>
  );
}

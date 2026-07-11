import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names and resolve Tailwind conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format an ISO date string into a short, locale-aware label. */
export function formatDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

/** Format stock quantity with unit, trimming unnecessary trailing zeros. */
export function formatStockQuantity(quantity: number, unit: string) {
  const formatted = Number.parseFloat(quantity.toFixed(10)).toString();
  return `${formatted} ${unit}`;
}

/** Truncate text for table cells; returns an em dash when empty. */
export function displayDescription(
  description?: string | null,
  maxLength = 80,
) {
  const trimmed = description?.trim();
  if (!trimmed) return "—";
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}…`;
}

/** Produce up-to-two-character initials from a name for avatars. */
export function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

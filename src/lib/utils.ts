import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { config } from "@/lib/config";
import type { PurchaseRequest, PurchaseRequestSummary } from "@/lib/api/types";
import { formatMeasurementQuantity } from "@/lib/units";

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

/** Format an ISO date string with time for detail views. */
export function formatDateTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Format a Date for `<input type="datetime-local" />` in the local timezone. */
export function dateToDatetimeLocalInput(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Parse a datetime-local input value to ISO8601 (UTC). */
export function datetimeLocalInputToIso(value: string) {
  return new Date(value).toISOString();
}

/** Compare two dates at minute precision (datetime-local resolution). */
export function datesEqualToMinute(left: Date, right: Date) {
  return (
    Math.floor(left.getTime() / 60_000) === Math.floor(right.getTime() / 60_000)
  );
}

/** Truncate an ID for compact table display. */
export function truncateId(id: string, length = 8) {
  if (id.length <= length) return id;
  return `${id.slice(0, length)}…`;
}

/** Format stock quantity with unit, including auto-conversion for display. */
export function formatStockQuantity(quantity: number | string, unit: string) {
  return formatMeasurementQuantity(quantity, unit);
}

/** Format a signed quantity delta for manual edit history (prefix + for positive). */
export function formatSignedQuantityDelta(delta: string) {
  const trimmed = delta?.trim();
  if (!trimmed) return "—";
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return trimmed;
  const formatted = Number.parseFloat(n.toFixed(10)).toString();
  return n > 0 ? `+${formatted}` : formatted;
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

/** Default food photo served from the public directory. */
export const DEFAULT_FOOD_PHOTO_URL = "/default-food.svg";

/** Format an integer amount as Indonesian Rupiah (e.g. Rp 35.000). */
export function formatRupiah(amount: number) {
  return `Rp ${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

/** Format break-even day/month estimates; null or undefined renders as N/A. */
export function formatBepValue(value: number | null | undefined): string {
  if (value == null) return "N/A";
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

/** Compute unit price from a supplier price quote (price_amount / price_quantity). */
export function computeSupplierUnitPrice(
  priceAmount: number,
  priceQuantity: number,
) {
  if (
    !Number.isFinite(priceAmount) ||
    !Number.isFinite(priceQuantity) ||
    priceQuantity <= 0
  ) {
    return null;
  }
  return priceAmount / priceQuantity;
}

/** Format a supplier unit price for display (e.g. Rp 140 / gr). */
export function formatSupplierUnitPrice(
  priceAmount: number,
  priceQuantity: number,
  unit: string,
) {
  const unitPrice = computeSupplierUnitPrice(priceAmount, priceQuantity);
  if (unitPrice == null) return "—";
  const formatted = Number.parseFloat(unitPrice.toFixed(4)).toString();
  return `${formatRupiah(Number.parseFloat(formatted))} / ${unit}`;
}

/**
 * Estimate a purchase line total using the same half-up rounding as the backend:
 * Math.round(quantity * price_amount / price_quantity).
 */
export function estimateLineAmount(
  priceAmount: number,
  priceQuantity: number,
  quantity: number,
) {
  if (
    !Number.isFinite(priceAmount) ||
    !Number.isFinite(priceQuantity) ||
    !Number.isFinite(quantity) ||
    priceQuantity <= 0 ||
    quantity <= 0
  ) {
    return 0;
  }
  return Math.round((quantity * priceAmount) / priceQuantity);
}

/** Resolve a menu photo URL, falling back to the default food image. */
export function menuPhotoUrl(photoUrl?: string | null) {
  const trimmed = photoUrl?.trim();
  if (!trimmed) return DEFAULT_FOOD_PHOTO_URL;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.startsWith("/static/")) {
    return `${config.apiBaseUrl}${trimmed}`;
  }
  return trimmed;
}

/** Extract a WhatsApp-ready phone number from free-form supplier contact info. */
export function extractWhatsAppPhone(contactInfo: string): string | null {
  const trimmed = contactInfo.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("08") && digits.length >= 10 && digits.length <= 13) {
    return `62${digits.slice(1)}`;
  }

  if (digits.startsWith("62") && digits.length >= 10 && digits.length <= 15) {
    return digits;
  }

  return null;
}

/** Build an Indonesian WhatsApp order message for a purchase request. */
export function buildPurchaseWhatsAppMessage(purchase: PurchaseRequest): string {
  const lines = purchase.items.map((item, index) => {
    const title = item.food_supply_title ?? "Bahan";
    const quantityLabel = formatMeasurementQuantity(
      item.quantity,
      item.unit ?? "",
    );
    return `${index + 1}. ${quantityLabel} ${title}`.trim();
  });

  const totalLines: string[] = [];
  if (purchase.total_actual_amount != null) {
    if (purchase.total_actual_amount !== purchase.total_estimated_amount) {
      totalLines.push(
        `Total: ${formatRupiah(purchase.total_actual_amount)} (estimasi: ${formatRupiah(purchase.total_estimated_amount)})`,
      );
    } else {
      totalLines.push(`Total: ${formatRupiah(purchase.total_actual_amount)}`);
    }
  } else {
    totalLines.push(
      `Estimasi total: ${formatRupiah(purchase.total_estimated_amount)}`,
    );
  }

  return [
    `Halo ${purchase.supplier_name},`,
    "",
    "Kami ingin memesan bahan berikut:",
    ...lines,
    "",
    ...totalLines,
    "",
    "Terima kasih.",
  ].join("\n");
}

/** Prefer actual purchase total for list display when present. */
export function formatPurchaseSummaryTotal(
  purchase: Pick<PurchaseRequestSummary, "total_estimated_amount" | "total_actual_amount">,
): string {
  if (purchase.total_actual_amount != null) {
    return formatRupiah(purchase.total_actual_amount);
  }
  return formatRupiah(purchase.total_estimated_amount);
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

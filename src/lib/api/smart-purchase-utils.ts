import type {
  PurchaseRequestSupplierGroup,
  PurchaseRequestSupplierQuote,
  PurchaseRequestSuggestItem,
  FoodSupplySupplierPrice,
} from "./types";
import { estimateLineAmount } from "@/lib/utils";

export interface SmartPurchaseWizardItem extends PurchaseRequestSuggestItem {
  manual_supplier_prices?: FoodSupplySupplierPrice[];
}

export interface BatchPurchaseGroupPayload {
  supplier_id: string;
  items: { food_supply_id: string; quantity: string }[];
}

export interface BatchPurchaseRequestsPayload {
  groups: BatchPurchaseGroupPayload[];
  notes?: string;
}

/** Find a supplier quote from suggest quotes or manually loaded prices. */
export function findSupplierQuote(
  supplierId: string,
  item: SmartPurchaseWizardItem,
): PurchaseRequestSupplierQuote | null {
  const fromSuggest = item.all_supplier_quotes.find(
    (quote) => quote.supplier_id === supplierId,
  );
  if (fromSuggest) return fromSuggest;

  const manual = item.manual_supplier_prices?.find(
    (price) => price.supplier_id === supplierId,
  );
  if (!manual) return null;

  const unitPrice =
    manual.unit_price ??
    (manual.price_quantity > 0
      ? manual.price_amount / manual.price_quantity
      : 0);

  return {
    supplier_id: supplierId,
    supplier_name: manual.supplier_name ?? "Unknown supplier",
    supplier_price_id: manual.id,
    price_amount: manual.price_amount,
    price_quantity: manual.price_quantity,
    unit_price: unitPrice,
  };
}

/** Apply a supplier quote to a wizard item and recalculate the line total. */
export function applySupplierQuoteToItem(
  item: SmartPurchaseWizardItem,
  quote: PurchaseRequestSupplierQuote,
): SmartPurchaseWizardItem {
  const lineEstimated = estimateLineAmount(
    quote.price_amount,
    quote.price_quantity,
    item.quantity,
  );

  return {
    ...item,
    selected_supplier_id: quote.supplier_id,
    selected_supplier_name: quote.supplier_name,
    price_amount: quote.price_amount,
    price_quantity: quote.price_quantity,
    unit_price: quote.unit_price,
    line_estimated_amount: lineEstimated,
  };
}

/** Group wizard items by their currently selected supplier for display. */
export function groupWizardItemsBySupplier(
  items: SmartPurchaseWizardItem[],
): PurchaseRequestSupplierGroup[] {
  const groups = new Map<string, PurchaseRequestSupplierGroup>();

  for (const item of items) {
    if (!item.selected_supplier_id) continue;

    const supplierId = item.selected_supplier_id;
    const supplierName =
      item.selected_supplier_name ??
      item.all_supplier_quotes.find((quote) => quote.supplier_id === supplierId)
        ?.supplier_name ??
      "Unknown supplier";

    const existing = groups.get(supplierId);
    if (existing) {
      existing.items.push(item);
      existing.group_total_estimated_amount =
        (existing.group_total_estimated_amount ?? 0) + item.line_estimated_amount;
    } else {
      groups.set(supplierId, {
        supplier_id: supplierId,
        supplier_name: supplierName,
        items: [item],
        group_total_estimated_amount: item.line_estimated_amount,
      });
    }
  }

  return Array.from(groups.values());
}

/** Build the batch API payload from current wizard item selections. */
export function buildBatchPurchasePayload(
  items: SmartPurchaseWizardItem[],
  notes?: string,
): BatchPurchaseRequestsPayload {
  const groups = new Map<string, BatchPurchaseGroupPayload>();

  for (const item of items) {
    if (!item.selected_supplier_id) continue;

    const existing = groups.get(item.selected_supplier_id);
    const lineItem = {
      food_supply_id: item.food_supply_id,
      quantity: String(item.quantity),
    };

    if (existing) {
      existing.items.push(lineItem);
    } else {
      groups.set(item.selected_supplier_id, {
        supplier_id: item.selected_supplier_id,
        items: [lineItem],
      });
    }
  }

  const payload: BatchPurchaseRequestsPayload = {
    groups: Array.from(groups.values()),
  };

  const trimmedNotes = notes?.trim();
  if (trimmedNotes) {
    payload.notes = trimmedNotes;
  }

  return payload;
}

export function wizardItemsFromSuggest(
  items: PurchaseRequestSuggestItem[],
): SmartPurchaseWizardItem[] {
  return items.map((item) => ({ ...item }));
}

export function allItemsHaveSupplier(items: SmartPurchaseWizardItem[]): boolean {
  return items.length > 0 && items.every((item) => Boolean(item.selected_supplier_id));
}

export function supplierOptionsForItem(
  item: SmartPurchaseWizardItem,
): PurchaseRequestSupplierQuote[] {
  const bySupplier = new Map<string, PurchaseRequestSupplierQuote>();

  for (const quote of item.all_supplier_quotes) {
    bySupplier.set(quote.supplier_id, quote);
  }

  for (const price of item.manual_supplier_prices ?? []) {
    if (!price.supplier_id || bySupplier.has(price.supplier_id)) continue;
    const unitPrice =
      price.unit_price ??
      (price.price_quantity > 0
        ? price.price_amount / price.price_quantity
        : 0);
    bySupplier.set(price.supplier_id, {
      supplier_id: price.supplier_id,
      supplier_name: price.supplier_name ?? "Unknown supplier",
      supplier_price_id: price.id,
      price_amount: price.price_amount,
      price_quantity: price.price_quantity,
      unit_price: unitPrice,
    });
  }

  return Array.from(bySupplier.values());
}

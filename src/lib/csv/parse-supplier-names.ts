/** Parse a single CSV row, handling quoted fields and escaped quotes. */
export function parseCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }

  result.push(current);
  return result;
}

export interface ParsePurchaseCsvSupplierNamesResult {
  supplierNames: string[];
  error?: string;
}

/**
 * Best-effort extraction of unique `supplier_name` values from a purchase import CSV.
 * Returns a user-facing error when the file is empty or missing the column.
 */
export function parseSupplierNamesFromPurchaseCsv(
  text: string,
): ParsePurchaseCsvSupplierNamesResult {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { supplierNames: [], error: "CSV file is empty" };
  }

  const headers = parseCsvRow(lines[0]).map((header) => header.trim());
  const supplierIndex = headers.findIndex(
    (header) => header.toLowerCase() === "supplier_name",
  );
  if (supplierIndex === -1) {
    return {
      supplierNames: [],
      error: "CSV must include a supplier_name column",
    };
  }

  const names = new Set<string>();
  for (let rowIndex = 1; rowIndex < lines.length; rowIndex++) {
    const row = parseCsvRow(lines[rowIndex]);
    const supplierName = row[supplierIndex]?.trim();
    if (supplierName) {
      names.add(supplierName);
    }
  }

  return { supplierNames: Array.from(names).sort((a, b) => a.localeCompare(b)) };
}

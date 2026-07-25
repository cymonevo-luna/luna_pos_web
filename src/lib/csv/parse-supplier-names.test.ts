import { describe, it, expect } from "vitest";
import {
  parseCsvRow,
  parseSupplierNamesFromPurchaseCsv,
} from "./parse-supplier-names";

describe("parseCsvRow", () => {
  it("splits simple comma-separated values", () => {
    expect(parseCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("handles quoted fields with commas", () => {
    expect(parseCsvRow('item,"Supplier, Inc",2')).toEqual([
      "item",
      "Supplier, Inc",
      "2",
    ]);
  });

  it("handles escaped quotes inside quoted fields", () => {
    expect(parseCsvRow('"Say ""Hello""",Supplier')).toEqual([
      'Say "Hello"',
      "Supplier",
    ]);
  });
});

describe("parseSupplierNamesFromPurchaseCsv", () => {
  it("returns unique supplier names from data rows", () => {
    const csv = [
      "item_name,supplier_name,quantity,price_per_quantity,total_price",
      "Beras,Beras Supplier,2,140000,280000",
      "Garam,Beras Supplier,1,5000,5000",
      "Sayur,Sayur Supplier,3,10000,30000",
    ].join("\n");

    expect(parseSupplierNamesFromPurchaseCsv(csv)).toEqual({
      supplierNames: ["Beras Supplier", "Sayur Supplier"],
    });
  });

  it("returns an error when the file is empty", () => {
    expect(parseSupplierNamesFromPurchaseCsv("")).toEqual({
      supplierNames: [],
      error: "CSV file is empty",
    });
  });

  it("returns an error when supplier_name column is missing", () => {
    expect(parseSupplierNamesFromPurchaseCsv("item_name,quantity\nBeras,2")).toEqual(
      {
        supplierNames: [],
        error: "CSV must include a supplier_name column",
      },
    );
  });

  it("ignores blank supplier cells", () => {
    const csv = [
      "item_name,supplier_name,quantity",
      "Beras,Beras Supplier,2",
      "Garam,,1",
    ].join("\n");

    expect(parseSupplierNamesFromPurchaseCsv(csv)).toEqual({
      supplierNames: ["Beras Supplier"],
    });
  });
});

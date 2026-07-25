import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PurchaseImportDialog } from "./purchase-import-dialog";
import {
  downloadPurchaseImportTemplate,
  downloadPurchaseImportTemplateFile,
  importPurchaseRequestsCsv,
} from "@/lib/api/purchase-requests";
import { uploadPurchaseProof } from "@/lib/api/uploads";
import { ApiError } from "@/lib/api/client";
import * as wib from "@/lib/datetime/wib";
import { toast } from "sonner";

vi.mock("@/lib/api/purchase-requests", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/purchase-requests")>();
  return {
    ...actual,
    downloadPurchaseImportTemplate: vi.fn(),
    downloadPurchaseImportTemplateFile: vi.fn(),
    importPurchaseRequestsCsv: vi.fn(),
  };
});

vi.mock("@/lib/api/uploads", () => ({
  uploadPurchaseProof: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function createImageFile(name = "proof.jpg"): File {
  return new File(["image"], name, { type: "image/jpeg" });
}

function createCsvFile(content: string, name = "import.csv"): File {
  return new File([content], name, { type: "text/csv" });
}

describe("PurchaseImportDialog", () => {
  const onClose = vi.fn();
  const onImported = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(wib, "todayWIB").mockReturnValue("2026-07-25");
  });

  it("downloads the import template", async () => {
    const user = userEvent.setup();
    const blob = new Blob(["item_name,supplier_name"]);
    vi.mocked(downloadPurchaseImportTemplate).mockResolvedValue({
      blob,
      filename: "purchase-import-template.csv",
    });

    render(
      <PurchaseImportDialog open onClose={onClose} onImported={onImported} />,
    );

    await user.click(screen.getByTestId("download-import-template"));

    await waitFor(() => {
      expect(downloadPurchaseImportTemplate).toHaveBeenCalled();
      expect(downloadPurchaseImportTemplateFile).toHaveBeenCalledWith(blob, {
        filename: "purchase-import-template.csv",
      });
      expect(toast.success).toHaveBeenCalledWith("Import template downloaded");
    });
  });

  it("imports a valid CSV for PENDING target", async () => {
    const user = userEvent.setup();
    vi.mocked(importPurchaseRequestsCsv).mockResolvedValue({ created_count: 2 });

    render(
      <PurchaseImportDialog open onClose={onClose} onImported={onImported} />,
    );

    const csv = [
      "item_name,supplier_name,quantity,price_per_quantity,total_price",
      "Beras,Beras Supplier,2,140000,280000",
    ].join("\n");

    await user.upload(screen.getByTestId("import-csv-input"), createCsvFile(csv));
    await user.click(screen.getByTestId("import-purchase-requests"));

    await waitFor(() => {
      expect(importPurchaseRequestsCsv).toHaveBeenCalledWith({
        file: expect.objectContaining({ name: "import.csv" }),
        transactionDate: "2026-07-25",
        targetStatus: "PENDING",
        proofs: undefined,
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Imported 2 purchase requests",
      );
      expect(onImported).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("shows row validation errors from the API", async () => {
    const user = userEvent.setup();
    vi.mocked(importPurchaseRequestsCsv).mockRejectedValue(
      new ApiError(422, "validation_error", "Import validation failed", {
        "row_3.supplier_name": "Supplier is not registered",
      }),
    );

    render(
      <PurchaseImportDialog open onClose={onClose} onImported={onImported} />,
    );

    const csv = [
      "item_name,supplier_name,quantity,price_per_quantity,total_price",
      "Beras,Unknown Supplier,2,140000,280000",
    ].join("\n");

    await user.upload(screen.getByTestId("import-csv-input"), createCsvFile(csv));
    await user.click(screen.getByTestId("import-purchase-requests"));

    await waitFor(() => {
      expect(
        screen.getByText(/row_3\.supplier_name:/),
      ).toBeInTheDocument();
      expect(screen.getByText(/Supplier is not registered/)).toBeInTheDocument();
      expect(toast.error).toHaveBeenCalledWith("Import validation failed");
      expect(onImported).not.toHaveBeenCalled();
    });
  });

  it("shows per-supplier paid proof uploads for PAID target", async () => {
    const user = userEvent.setup();

    render(
      <PurchaseImportDialog open onClose={onClose} onImported={onImported} />,
    );

    await user.selectOptions(
      screen.getByLabelText("Import target state"),
      "PAID",
    );

    const csv = [
      "item_name,supplier_name,quantity,price_per_quantity,total_price",
      "Beras,Beras Supplier,2,140000,280000",
      "Sayur,Sayur Supplier,1,10000,10000",
    ].join("\n");

    await user.upload(screen.getByTestId("import-csv-input"), createCsvFile(csv));

    expect(screen.getByTestId("import-proof-section")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Paid proof — Beras Supplier"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Paid proof — Sayur Supplier"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("import-purchase-requests")).toBeDisabled();
  });

  it("imports PAID CSV after uploading proofs for each supplier", async () => {
    const user = userEvent.setup();
    vi.mocked(uploadPurchaseProof)
      .mockResolvedValueOnce({
        url: "https://cdn.example.com/beras-paid.jpg",
        filename: "beras-paid.jpg",
        size_bytes: 100,
      })
      .mockResolvedValueOnce({
        url: "https://cdn.example.com/sayur-paid.jpg",
        filename: "sayur-paid.jpg",
        size_bytes: 100,
      });
    vi.mocked(importPurchaseRequestsCsv).mockResolvedValue({ created_count: 2 });

    render(
      <PurchaseImportDialog open onClose={onClose} onImported={onImported} />,
    );

    await user.selectOptions(
      screen.getByLabelText("Import target state"),
      "PAID",
    );

    const csv = [
      "item_name,supplier_name,quantity,price_per_quantity,total_price",
      "Beras,Beras Supplier,2,140000,280000",
      "Sayur,Sayur Supplier,1,10000,10000",
    ].join("\n");

    await user.upload(screen.getByTestId("import-csv-input"), createCsvFile(csv));
    await user.upload(
      screen.getByTestId("paid-proof-Beras Supplier"),
      createImageFile("beras.jpg"),
    );
    await user.upload(
      screen.getByTestId("paid-proof-Sayur Supplier"),
      createImageFile("sayur.jpg"),
    );

    expect(screen.getByTestId("import-purchase-requests")).toBeEnabled();
    await user.click(screen.getByTestId("import-purchase-requests"));

    await waitFor(() => {
      expect(uploadPurchaseProof).toHaveBeenCalledTimes(2);
      expect(importPurchaseRequestsCsv).toHaveBeenCalledWith({
        file: expect.objectContaining({ name: "import.csv" }),
        transactionDate: "2026-07-25",
        targetStatus: "PAID",
        proofs: {
          "Beras Supplier": {
            paid_proof_url: "https://cdn.example.com/beras-paid.jpg",
          },
          "Sayur Supplier": {
            paid_proof_url: "https://cdn.example.com/sayur-paid.jpg",
          },
        },
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Imported 2 purchase requests",
      );
    });
  });
});

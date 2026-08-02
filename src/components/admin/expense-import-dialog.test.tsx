import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExpenseImportDialog } from "./expense-import-dialog";
import {
  downloadExpenseImportTemplate,
  downloadExpenseImportTemplateFile,
  importExpensesCsv,
} from "@/lib/api/expenses";
import { ApiError } from "@/lib/api/client";
import * as wib from "@/lib/datetime/wib";
import { toast } from "sonner";

vi.mock("@/lib/api/expenses", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/expenses")>();
  return {
    ...actual,
    downloadExpenseImportTemplate: vi.fn(),
    downloadExpenseImportTemplateFile: vi.fn(),
    importExpensesCsv: vi.fn(),
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function createCsvFile(content: string, name = "import.csv"): File {
  return new File([content], name, { type: "text/csv" });
}

describe("ExpenseImportDialog", () => {
  const onClose = vi.fn();
  const onImported = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(wib, "todayWIB").mockReturnValue("2026-07-25");
  });

  it("renders the import dialog when open", () => {
    render(
      <ExpenseImportDialog open onClose={onClose} onImported={onImported} />,
    );

    expect(screen.getByTestId("expense-import-dialog")).toBeInTheDocument();
    expect(screen.getByText("Import expenses")).toBeInTheDocument();
    expect(screen.getByTestId("download-import-template")).toBeInTheDocument();
    expect(screen.getByTestId("import-expenses")).toBeDisabled();
  });

  it("downloads the import template", async () => {
    const user = userEvent.setup();
    const blob = new Blob(["title,amount,description,source_of_fund,receipt_url"]);
    vi.mocked(downloadExpenseImportTemplate).mockResolvedValue({
      blob,
      filename: "expense-import-template.csv",
    });

    render(
      <ExpenseImportDialog open onClose={onClose} onImported={onImported} />,
    );

    await user.click(screen.getByTestId("download-import-template"));

    await waitFor(() => {
      expect(downloadExpenseImportTemplate).toHaveBeenCalled();
      expect(downloadExpenseImportTemplateFile).toHaveBeenCalledWith(blob, {
        filename: "expense-import-template.csv",
      });
      expect(toast.success).toHaveBeenCalledWith("Import template downloaded");
    });
  });

  it("imports a valid CSV and calls onImported", async () => {
    const user = userEvent.setup();
    vi.mocked(importExpensesCsv).mockResolvedValue({ imported_row_count: 2 });

    render(
      <ExpenseImportDialog open onClose={onClose} onImported={onImported} />,
    );

    const csv = [
      "title,amount,description,source_of_fund,receipt_url",
      "Office supplies,150000,Printer paper,PERSONAL_MONEY,",
    ].join("\n");

    await user.upload(screen.getByTestId("import-csv-input"), createCsvFile(csv));
    await user.click(screen.getByTestId("import-expenses"));

    await waitFor(() => {
      expect(importExpensesCsv).toHaveBeenCalledWith({
        file: expect.objectContaining({ name: "import.csv" }),
        transactionDate: "2026-07-25",
      });
      expect(toast.success).toHaveBeenCalledWith("Imported 2 expenses");
      expect(onImported).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("shows row validation errors from the API", async () => {
    const user = userEvent.setup();
    vi.mocked(importExpensesCsv).mockRejectedValue(
      new ApiError(422, "validation_error", "Import validation failed", {
        "row_2.amount": "Amount must be positive",
      }),
    );

    render(
      <ExpenseImportDialog open onClose={onClose} onImported={onImported} />,
    );

    const csv = [
      "title,amount,description,source_of_fund,receipt_url",
      "Office supplies,-100,,PERSONAL_MONEY,",
    ].join("\n");

    await user.upload(screen.getByTestId("import-csv-input"), createCsvFile(csv));
    await user.click(screen.getByTestId("import-expenses"));

    await waitFor(() => {
      expect(screen.getByText(/row_2\.amount:/)).toBeInTheDocument();
      expect(screen.getByText(/Amount must be positive/)).toBeInTheDocument();
      expect(toast.error).toHaveBeenCalledWith("Import validation failed");
      expect(onImported).not.toHaveBeenCalled();
    });
  });
});

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import {
  downloadExpenseImportTemplate,
  downloadExpenseImportTemplateFile,
  importExpensesCsv,
} from "@/lib/api/expenses";
import { ApiError } from "@/lib/api/client";
import { todayWIB } from "@/lib/datetime/wib";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ExpenseImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function ExpenseImportDialog({
  open,
  onClose,
  onImported,
}: ExpenseImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [transactionDate, setTransactionDate] = useState(todayWIB());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [importing, setImporting] = useState(false);

  const resetForm = useCallback(() => {
    setTransactionDate(todayWIB());
    setSelectedFile(null);
    setFieldErrors({});
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleClose = useCallback(() => {
    if (importing) return;
    resetForm();
    onClose();
  }, [importing, onClose, resetForm]);

  useEffect(() => {
    if (!open) return;
    setTransactionDate(todayWIB());
  }, [open]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.file;
      return next;
    });
    event.target.value = "";
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const { blob, filename } = await downloadExpenseImportTemplate();
      downloadExpenseImportTemplateFile(blob, { filename });
      toast.success("Import template downloaded");
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to download import template",
      );
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const canImport = Boolean(selectedFile && transactionDate) && !importing;

  const handleImport = async () => {
    if (!selectedFile || !transactionDate) return;

    setImporting(true);
    setFieldErrors({});

    try {
      const result = await importExpensesCsv({
        file: selectedFile,
        transactionDate,
      });

      toast.success(
        `Imported ${result.imported_row_count} expense${result.imported_row_count === 1 ? "" : "s"}`,
      );
      resetForm();
      onClose();
      onImported();
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setFieldErrors(err.fields);
      }
      toast.error(
        err instanceof ApiError ? err.message : "Failed to import expenses",
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      className="max-h-[90vh] max-w-lg overflow-y-auto"
    >
      <div data-testid="expense-import-dialog">
        <DialogTitle>Import expenses</DialogTitle>
        <DialogDescription>
          Upload a CSV file to bulk-create expenses. Use the template for the
          expected column format. The <code>source_of_fund</code> column accepts{" "}
          <code>CASHIER</code>, <code>QRIS</code>, or <code>PERSONAL_MONEY</code>.
        </DialogDescription>

        <div className="mt-4 space-y-4">
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              isLoading={downloadingTemplate}
              onClick={() => void handleDownloadTemplate()}
              data-testid="download-import-template"
            >
              <Download className="h-4 w-4" />
              Download template
            </Button>
          </div>

          <div>
            <Label htmlFor="import-transaction-date">Transaction date</Label>
            <Input
              id="import-transaction-date"
              type="date"
              value={transactionDate}
              onChange={(event) => {
                setTransactionDate(event.target.value);
                setFieldErrors((current) => {
                  const next = { ...current };
                  delete next.transaction_date;
                  return next;
                });
              }}
              className="mt-2"
              aria-invalid={Boolean(fieldErrors.transaction_date)}
              data-testid="import-transaction-date"
            />
            {fieldErrors.transaction_date && (
              <p className="text-destructive mt-1 text-sm" role="alert">
                {fieldErrors.transaction_date}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="import-csv-file">CSV file</Label>
            <input
              ref={fileInputRef}
              id="import-csv-file"
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              data-testid="import-csv-input"
              onChange={handleFileChange}
              disabled={importing}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={importing}
                onClick={() => fileInputRef.current?.click()}
                data-testid="import-csv-button"
              >
                <Upload className="h-4 w-4" />
                {selectedFile ? "Change file" : "Choose CSV"}
              </Button>
              {selectedFile ? (
                <span className="text-sm text-muted-foreground">
                  {selectedFile.name}
                </span>
              ) : null}
            </div>
            {fieldErrors.file && (
              <p className="text-destructive mt-1 text-sm" role="alert">
                {fieldErrors.file}
              </p>
            )}
          </div>

          {Object.entries(fieldErrors)
            .filter(
              ([key]) => !["transaction_date", "file"].includes(key),
            )
            .map(([key, message]) => (
              <p key={key} className="text-destructive text-sm" role="alert">
                <span className="font-medium">{key}:</span> {message}
              </p>
            ))}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={importing}
          >
            Cancel
          </Button>
          <Button
            type="button"
            isLoading={importing}
            disabled={!canImport}
            onClick={() => void handleImport()}
            data-testid="import-expenses"
          >
            Import
          </Button>
        </DialogFooter>
      </div>
    </Dialog>
  );
}

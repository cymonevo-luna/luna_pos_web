"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import {
  downloadPurchaseImportTemplate,
  downloadPurchaseImportTemplateFile,
  importPurchaseRequestsCsv,
  type PurchaseImportProofsMap,
} from "@/lib/api/purchase-requests";
import { uploadPurchaseProof } from "@/lib/api/uploads";
import { ApiError } from "@/lib/api/client";
import type { PurchaseRequestStatus } from "@/lib/api/types";
import { parseSupplierNamesFromPurchaseCsv } from "@/lib/csv/parse-supplier-names";
import { todayWIB } from "@/lib/datetime/wib";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

const TARGET_STATUS_OPTIONS = [
  { value: "PENDING", label: "PENDING" },
  { value: "REQUESTED", label: "REQUESTED" },
  { value: "PAID", label: "PAID" },
  { value: "DELIVERED", label: "DELIVERED" },
] as const;

type ProofKind = "paid" | "delivered";

type ProofFilesState = Record<
  string,
  Partial<Record<ProofKind, File>>
>;

export interface PurchaseImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

function requiresPaidProof(status: PurchaseRequestStatus): boolean {
  return status === "PAID" || status === "DELIVERED";
}

function requiresDeliveredProof(status: PurchaseRequestStatus): boolean {
  return status === "DELIVERED";
}

export function PurchaseImportDialog({
  open,
  onClose,
  onImported,
}: PurchaseImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [transactionDate, setTransactionDate] = useState(todayWIB());
  const [targetStatus, setTargetStatus] =
    useState<PurchaseRequestStatus>("PENDING");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [supplierNames, setSupplierNames] = useState<string[]>([]);
  const [csvParseError, setCsvParseError] = useState<string | null>(null);
  const [proofFiles, setProofFiles] = useState<ProofFilesState>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [importing, setImporting] = useState(false);

  const resetForm = useCallback(() => {
    setTransactionDate(todayWIB());
    setTargetStatus("PENDING");
    setSelectedFile(null);
    setSupplierNames([]);
    setCsvParseError(null);
    setProofFiles({});
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

  const parseCsvFile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseSupplierNamesFromPurchaseCsv(text);
      setSupplierNames(parsed.supplierNames);
      setCsvParseError(parsed.error ?? null);
    } catch {
      setSupplierNames([]);
      setCsvParseError("Could not read the CSV file");
    }
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setProofFiles({});
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.file;
      return next;
    });

    if (!file) {
      setSupplierNames([]);
      setCsvParseError(null);
      return;
    }

    void parseCsvFile(file);
    event.target.value = "";
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const { blob, filename } = await downloadPurchaseImportTemplate();
      downloadPurchaseImportTemplateFile(blob, { filename });
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

  const handleProofFileChange = (
    supplierName: string,
    kind: ProofKind,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setProofFiles((current) => ({
      ...current,
      [supplierName]: {
        ...current[supplierName],
        [kind]: file,
      },
    }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[`proofs.${supplierName}.${kind}`];
      return next;
    });
  };

  const missingProofs = useMemo(() => {
    if (!requiresPaidProof(targetStatus) || supplierNames.length === 0) {
      return false;
    }

    return supplierNames.some((supplierName) => {
      const proofs = proofFiles[supplierName];
      if (requiresDeliveredProof(targetStatus)) {
        return !proofs?.paid || !proofs?.delivered;
      }
      return !proofs?.paid;
    });
  }, [proofFiles, supplierNames, targetStatus]);

  const canImport =
    Boolean(selectedFile && transactionDate) &&
    !csvParseError &&
    !missingProofs &&
    !importing;

  const buildProofsMap = async (): Promise<PurchaseImportProofsMap> => {
    const proofs: PurchaseImportProofsMap = {};

    for (const supplierName of supplierNames) {
      const files = proofFiles[supplierName];
      if (!files) continue;

      const entry: PurchaseImportProofsMap[string] = {};

      if (files.paid) {
        const uploaded = await uploadPurchaseProof(files.paid);
        entry.paid_proof_url = uploaded.url;
      }

      if (files.delivered) {
        const uploaded = await uploadPurchaseProof(files.delivered);
        entry.delivered_proof_url = uploaded.url;
      }

      if (entry.paid_proof_url || entry.delivered_proof_url) {
        proofs[supplierName] = entry;
      }
    }

    return proofs;
  };

  const handleImport = async () => {
    if (!selectedFile || !transactionDate) return;

    setImporting(true);
    setFieldErrors({});

    try {
      const proofs =
        requiresPaidProof(targetStatus) && supplierNames.length > 0
          ? await buildProofsMap()
          : undefined;

      const result = await importPurchaseRequestsCsv({
        file: selectedFile,
        transactionDate,
        targetStatus,
        proofs,
      });

      toast.success(
        `Imported ${result.created_count} purchase request${result.created_count === 1 ? "" : "s"}`,
      );
      resetForm();
      onClose();
      onImported();
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setFieldErrors(err.fields);
      }
      toast.error(
        err instanceof ApiError ? err.message : "Failed to import purchase requests",
      );
    } finally {
      setImporting(false);
    }
  };

  const showProofSection =
    requiresPaidProof(targetStatus) &&
    selectedFile &&
    supplierNames.length > 0 &&
    !csvParseError;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      className="max-h-[90vh] max-w-lg overflow-y-auto"
    >
      <div data-testid="purchase-import-dialog">
      <DialogTitle>Import purchase requests</DialogTitle>
      <DialogDescription>
        Upload a CSV file to bulk-create purchase requests. Use the template for
        the expected column format.
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
          <Label htmlFor="import-target-status">Target state</Label>
          <Select
            id="import-target-status"
            aria-label="Import target state"
            className="mt-2"
            options={[...TARGET_STATUS_OPTIONS]}
            value={targetStatus}
            onChange={(event) => {
              setTargetStatus(event.target.value as PurchaseRequestStatus);
              setProofFiles({});
              setFieldErrors((current) => {
                const next = { ...current };
                delete next.target_status;
                return next;
              });
            }}
            data-testid="import-target-status"
          />
          {fieldErrors.target_status && (
            <p className="text-destructive mt-1 text-sm" role="alert">
              {fieldErrors.target_status}
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
          {csvParseError && (
            <p className="text-destructive mt-1 text-sm" role="alert">
              {csvParseError}
            </p>
          )}
        </div>

        {showProofSection ? (
          <div
            className="space-y-4 rounded-lg border border-border p-4"
            data-testid="import-proof-section"
          >
            <p className="text-sm font-medium">Proof uploads</p>
            {supplierNames.map((supplierName) => (
              <div key={supplierName} className="space-y-3">
                <p className="text-sm font-medium">{supplierName}</p>
                <div className="space-y-2">
                  <ProofUploadField
                    id={`paid-proof-${supplierName}`}
                    label={`Paid proof — ${supplierName}`}
                    testId={`paid-proof-${supplierName}`}
                    disabled={importing}
                    selectedFile={proofFiles[supplierName]?.paid}
                    onChange={(event) =>
                      handleProofFileChange(supplierName, "paid", event)
                    }
                    error={fieldErrors[`proofs.${supplierName}.paid`]}
                  />
                  {requiresDeliveredProof(targetStatus) ? (
                    <ProofUploadField
                      id={`delivered-proof-${supplierName}`}
                      label={`Delivered proof — ${supplierName}`}
                      testId={`delivered-proof-${supplierName}`}
                      disabled={importing}
                      selectedFile={proofFiles[supplierName]?.delivered}
                      onChange={(event) =>
                        handleProofFileChange(supplierName, "delivered", event)
                      }
                      error={fieldErrors[`proofs.${supplierName}.delivered`]}
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {Object.entries(fieldErrors)
          .filter(
            ([key]) =>
              ![
                "transaction_date",
                "target_status",
                "file",
              ].includes(key) &&
              !key.startsWith("proofs."),
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
          data-testid="import-purchase-requests"
        >
          Import
        </Button>
      </DialogFooter>
      </div>
    </Dialog>
  );
}

function ProofUploadField({
  id,
  label,
  testId,
  disabled,
  selectedFile,
  onChange,
  error,
}: {
  id: string;
  label: string;
  testId: string;
  disabled: boolean;
  selectedFile?: File;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="mt-2"
        data-testid={testId}
        disabled={disabled}
        onChange={onChange}
      />
      {selectedFile ? (
        <p className="text-muted-foreground mt-1 text-xs">{selectedFile.name}</p>
      ) : (
        <p className="text-muted-foreground mt-1 text-xs">
          JPEG, PNG, or WebP up to 5 MB.
        </p>
      )}
      {error ? (
        <p className="text-destructive mt-1 text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { useExpenses, useUploadExpenseReceipt } from "@/lib/hooks/use-expenses";

export default function ExpensesDevPage() {
  const { expenses, loading, error, meta } = useExpenses({
    page: 1,
    perPage: 10,
  });
  const { mutateAsync: uploadReceipt, isPending: uploading } =
    useUploadExpenseReceipt();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadResult(null);
    try {
      const result = await uploadReceipt(file);
      setUploadResult(result.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-6 p-6" data-testid="expenses-dev-page">
      <div>
        <h1 className="text-2xl font-semibold">Expenses API Dev Harness</h1>
        <p className="text-muted-foreground text-sm">
          Temporary page for POS-79-3 hook verification.
        </p>
      </div>

      <section className="space-y-2" data-testid="expenses-list-section">
        <h2 className="text-lg font-medium">useExpenses</h2>
        {loading && <p data-testid="expenses-loading">Loading expenses…</p>}
        {error && (
          <p className="text-destructive" data-testid="expenses-error">
            {error}
          </p>
        )}
        {!loading && !error && (
          <div data-testid="expenses-loaded">
            <p>Total: {meta?.total ?? expenses.length}</p>
            <ul className="list-disc pl-5">
              {expenses.map((expense) => (
                <li key={expense.id} data-testid={`expense-item-${expense.id}`}>
                  {expense.title} — {expense.amount}
                </li>
              ))}
            </ul>
            {expenses.length === 0 && (
              <p data-testid="expenses-empty">No expenses found.</p>
            )}
          </div>
        )}
      </section>

      <section className="space-y-2" data-testid="expenses-upload-section">
        <h2 className="text-lg font-medium">useUploadExpenseReceipt</h2>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          data-testid="expense-receipt-input"
          onChange={(event) => void handleUpload(event)}
        />
        {uploading && <p data-testid="upload-pending">Uploading…</p>}
        {uploadResult && (
          <p data-testid="upload-result">Uploaded: {uploadResult}</p>
        )}
        {uploadError && (
          <p className="text-destructive" data-testid="upload-error">
            {uploadError}
          </p>
        )}
      </section>
    </div>
  );
}

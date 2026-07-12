"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { suppliersAdminApi } from "@/lib/api/suppliers";
import { ApiError } from "@/lib/api/client";
import type { Supplier } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_PER_PAGE = 20;

export function formatSupplierOptionLabel(supplier: Pick<Supplier, "name" | "phone_number">) {
  return `${supplier.name} · ${supplier.phone_number}`;
}

export interface SupplierPickerProps {
  id?: string;
  label?: string;
  value: string;
  selectedSupplier?: Pick<Supplier, "id" | "name" | "phone_number"> | null;
  onChange: (supplier: Supplier) => void;
  disabled?: boolean;
  error?: string;
}

export function SupplierPicker({
  id,
  label = "Supplier",
  value,
  selectedSupplier,
  onChange,
  disabled = false,
  error,
}: SupplierPickerProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [options, setOptions] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const loadOptions = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await suppliersAdminApi.list({
        page: 1,
        perPage: SEARCH_PER_PAGE,
        search: debouncedSearch,
      });
      setOptions(result.data ?? []);
    } catch (err) {
      setOptions([]);
      setLoadError(
        err instanceof ApiError ? err.message : "Failed to load suppliers",
      );
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    if (!open) return;
    void loadOptions();
  }, [open, loadOptions]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const displayLabel = selectedSupplier
    ? formatSupplierOptionLabel(selectedSupplier)
    : "";

  const handleOpen = () => {
    if (disabled) return;
    setOpen(true);
    setSearch("");
  };

  const handleSelect = (supplier: Supplier) => {
    onChange(supplier);
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          onClick={handleOpen}
          className={cn(
            "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 flex h-11 w-full items-center justify-between rounded-xl border px-3.5 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
            !displayLabel && "text-muted-foreground",
          )}
        >
          <span className="truncate">{displayLabel || "Select a supplier"}</span>
          <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
        </button>

        {open && (
          <div className="border-border bg-background absolute z-20 mt-1 w-full rounded-xl border shadow-lg">
            <div className="border-border border-b p-2">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  autoFocus
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search suppliers"
                  className="pl-9"
                  aria-label="Search suppliers"
                />
              </div>
            </div>
            <ul
              id={listboxId}
              role="listbox"
              className="max-h-56 overflow-y-auto p-1"
            >
              {loading ? (
                <li className="text-muted-foreground px-3 py-2 text-sm">Loading…</li>
              ) : loadError ? (
                <li className="text-destructive px-3 py-2 text-sm">{loadError}</li>
              ) : options.length === 0 ? (
                <li className="text-muted-foreground px-3 py-2 text-sm">
                  No suppliers found.
                </li>
              ) : (
                options.map((option) => (
                  <li key={option.id} role="option" aria-selected={option.id === value}>
                    <button
                      type="button"
                      className={cn(
                        "hover:bg-muted/60 w-full rounded-lg px-3 py-2 text-left text-sm",
                        option.id === value && "bg-muted/40",
                      )}
                      onClick={() => handleSelect(option)}
                    >
                      {formatSupplierOptionLabel(option)}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}

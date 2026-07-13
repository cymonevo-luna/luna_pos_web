import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "./card";
import { Skeleton } from "./skeleton";

export interface Column<T> {
  /** Column header label. */
  header: string;
  /** Cell renderer for a row. */
  cell: (row: T) => React.ReactNode;
  /** Optional className applied to the cell and header. */
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  getRowClassName?: (row: T) => string | undefined;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  skeletonRows?: number;
}

/**
 * DataTable is a generic, presentational table with built-in loading, error and
 * empty states, matching the template's card-wrapped table styling.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  getRowClassName,
  loading = false,
  error = null,
  emptyMessage = "No records found.",
  skeletonRows = 5,
}: DataTableProps<T>) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-border bg-muted/50 text-muted-foreground border-b text-left">
            <tr>
              {columns.map((c, i) => (
                <th
                  key={i}
                  className={cn("px-4 py-3 font-medium", c.className)}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={i} className="border-border border-b">
                  {columns.map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className="h-4 w-24" />
                    </td>
                  ))}
                </tr>
              ))
            ) : error ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-destructive px-4 py-10 text-center"
                >
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-muted-foreground px-4 py-10 text-center"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={getRowKey(row)}
                  className={cn(
                    "border-border hover:bg-muted/30 border-b last:border-0",
                    getRowClassName?.(row),
                  )}
                >
                  {columns.map((c, i) => (
                    <td key={i} className={cn("px-4 py-3", c.className)}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

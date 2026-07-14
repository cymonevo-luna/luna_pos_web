import type { FoodSupplyManualEditHistoryEntry } from "@/lib/api/types";
import type { FoodSupplyUnit } from "@/lib/api/types";
import { formatDateTime, formatSignedQuantityDelta } from "@/lib/utils";
import { getUnitLabel } from "@/lib/units";

export interface FoodSupplyManualEditHistoryProps {
  history: FoodSupplyManualEditHistoryEntry[];
  unit: FoodSupplyUnit;
}

export function FoodSupplyManualEditHistory({
  history,
  unit,
}: FoodSupplyManualEditHistoryProps) {
  const unitLabel = getUnitLabel(unit);

  return (
    <section className="space-y-3 border-t border-border pt-4">
      <div>
        <h3 className="text-sm font-medium">Manual edit history</h3>
        <p className="text-xs text-muted-foreground">
          Manual stock quantity adjustments only.
        </p>
      </div>

      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No manual quantity edits yet
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Delta ({unitLabel})</th>
                <th className="px-3 py-2 font-medium">Updated by</th>
                <th className="px-3 py-2 font-medium">Date/time</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry, index) => (
                <tr
                  key={`${entry.created_at}-${entry.changed_by_username}-${index}`}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-3 py-2 font-medium tabular-nums">
                    {formatSignedQuantityDelta(entry.delta_quantity)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {entry.changed_by_username}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    <time dateTime={entry.created_at}>
                      {formatDateTime(entry.created_at)}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

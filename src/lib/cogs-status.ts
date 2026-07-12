import type { CogsStatus } from "@/lib/api/types";

export const COGS_STATUS_LABELS: Record<CogsStatus, string> = {
  complete: "Complete",
  missing_prices: "Missing prices",
  no_formula: "No formula",
};

/** Tailwind classes for status badge styling. */
export function cogsStatusBadgeClass(status: CogsStatus) {
  switch (status) {
    case "complete":
      return "border-transparent bg-success text-success-foreground";
    case "missing_prices":
      return "border-transparent bg-amber-500 text-white";
    case "no_formula":
      return "border-transparent bg-secondary text-secondary-foreground";
  }
}

/** Subtle row background tint keyed by COGS completeness status. */
export function cogsStatusRowClass(status: CogsStatus) {
  switch (status) {
    case "complete":
      return "bg-success/5";
    case "missing_prices":
      return "bg-amber-500/10";
    case "no_formula":
      return "bg-muted/40";
  }
}

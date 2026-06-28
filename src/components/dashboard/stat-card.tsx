import type { ComponentType } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export type AccentColor =
  | "blue"
  | "green"
  | "amber"
  | "red"
  | "purple"
  | "teal";

const accentMap: Record<AccentColor, string> = {
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  red: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  purple: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  teal: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
  color?: AccentColor;
  trend?: string;
  trendUp?: boolean;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  color = "blue",
  trend,
  trendUp = true,
}: StatCardProps) {
  return (
    <Card className="p-4">
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl",
          accentMap[color],
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight">{value}</p>
      <div className="mt-0.5 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        {trend && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-xs font-medium",
              trendUp
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400",
            )}
          >
            {trendUp ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {trend}
          </span>
        )}
      </div>
    </Card>
  );
}

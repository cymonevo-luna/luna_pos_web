import { cn } from "@/lib/utils";
import type { AccentColor } from "./stat-card";

export interface ActivityItem {
  id: string;
  title: string;
  time: string;
  color?: AccentColor;
}

const dotMap: Record<AccentColor, string> = {
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-rose-500",
  purple: "bg-violet-500",
  teal: "bg-teal-500",
};

export function ActivityList({ items }: { items: ActivityItem[] }) {
  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0">
          <span
            className={cn(
              "h-2.5 w-2.5 shrink-0 rounded-full",
              dotMap[item.color ?? "blue"],
            )}
          />
          <p className="flex-1 text-sm font-medium">{item.title}</p>
          <span className="text-xs text-muted-foreground">{item.time}</span>
        </li>
      ))}
    </ul>
  );
}

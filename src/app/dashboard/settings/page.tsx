"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMounted } from "@/lib/hooks/use-mounted";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const themes = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  return (
    <div className="max-w-xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Choose how the interface looks to you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {themes.map((option) => {
              const Icon = option.icon;
              const active = mounted && theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors",
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

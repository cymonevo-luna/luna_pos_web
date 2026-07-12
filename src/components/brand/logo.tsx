import { config } from "@/lib/config";
import { cn } from "@/lib/utils";

interface LogoMarkProps {
  className?: string;
}

/** The layered-diamond brand mark. */
export function LogoMark({ className }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-9 w-9", className)}
      aria-hidden="true"
    >
      <rect width="48" height="48" rx="12" fill="var(--color-primary)" />
      <path
        d="M24 11l9 5.2-9 5.2-9-5.2L24 11z"
        fill="white"
        fillOpacity="0.95"
      />
      <path
        d="M15 22.5l9 5.2 9-5.2"
        stroke="white"
        strokeOpacity="0.7"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 28.5l9 5.2 9-5.2"
        stroke="white"
        strokeOpacity="0.45"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export function Logo({ className, showText = true }: LogoProps) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      {showText && (
        <span className="text-lg font-bold tracking-tight">{config.appName}</span>
      )}
    </span>
  );
}

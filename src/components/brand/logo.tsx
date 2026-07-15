import Image from "next/image";
import { config } from "@/lib/config";
import { cn } from "@/lib/utils";

const LOGO_SRC = "/brand/logo.png";

interface LogoMarkProps {
  className?: string;
  alt?: string;
  "aria-hidden"?: boolean;
}

/** The Luna brand mark. */
export function LogoMark({
  className,
  alt = "",
  "aria-hidden": ariaHidden,
}: LogoMarkProps) {
  return (
    <Image
      src={LOGO_SRC}
      alt={alt}
      width={36}
      height={36}
      aria-hidden={ariaHidden}
      className={cn("h-9 w-9 object-contain", className)}
    />
  );
}

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export function Logo({ className, showText = true }: LogoProps) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark
        alt={showText ? "" : config.appName}
        aria-hidden={showText ? true : undefined}
      />
      {showText && (
        <span className="text-lg font-bold tracking-tight">{config.appName}</span>
      )}
    </span>
  );
}

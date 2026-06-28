"use client";

import Image from "next/image";
import { useState } from "react";
import { cn, initials } from "@/lib/utils";

interface AvatarProps {
  name: string;
  src?: string | null;
  className?: string;
  /** Tailwind text size for the fallback initials. */
  textClassName?: string;
}

export function Avatar({ name, src, className, textClassName }: AvatarProps) {
  const [errored, setErrored] = useState(false);
  const showImage = src && !errored;

  return (
    <span
      className={cn(
        "relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft font-semibold text-primary",
        className,
      )}
    >
      {showImage ? (
        <Image
          src={src}
          alt={name}
          fill
          sizes="96px"
          className="object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        <span className={cn("text-sm", textClassName)}>{initials(name)}</span>
      )}
    </span>
  );
}

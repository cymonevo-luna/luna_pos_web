"use client";

import Image from "next/image";
import { useState } from "react";

const PNG_SRC = "/landing/pos-app-mockup.png";
const SVG_SRC = "/landing/pos-app-mockup.svg";

export function PosAppMockup() {
  const [src, setSrc] = useState(PNG_SRC);

  return (
    <div className="relative mx-auto w-full max-w-[280px] rounded-[2.5rem] border-[6px] border-foreground/10 bg-foreground/5 p-2 shadow-2xl shadow-primary/10 ring-1 ring-border">
      <div className="overflow-hidden rounded-[2rem] bg-background">
        <Image
          src={src}
          alt="Luna POS cashier app on a phone"
          width={280}
          height={560}
          className="h-auto w-full"
          priority
          onError={() => {
            if (src !== SVG_SRC) {
              setSrc(SVG_SRC);
            }
          }}
        />
      </div>
      <div
        className="pointer-events-none absolute left-1/2 top-3 h-1.5 w-16 -translate-x-1/2 rounded-full bg-foreground/20"
        aria-hidden
      />
    </div>
  );
}

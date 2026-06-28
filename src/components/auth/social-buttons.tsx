"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M16.36 12.78c.03 3.13 2.75 4.17 2.78 4.18-.02.07-.43 1.49-1.43 2.95-.86 1.27-1.76 2.53-3.17 2.55-1.39.03-1.83-.82-3.42-.82-1.58 0-2.08.8-3.39.85-1.36.05-2.4-1.37-3.27-2.63-1.78-2.58-3.14-7.28-1.31-10.46.9-1.58 2.52-2.58 4.28-2.6 1.34-.03 2.6.9 3.42.9.82 0 2.35-1.11 3.96-.95.67.03 2.56.27 3.78 2.05-.1.06-2.26 1.32-2.23 3.95zM13.82 3.5c.72-.88 1.21-2.1 1.08-3.32-1.04.04-2.3.69-3.05 1.57-.67.78-1.26 2.02-1.1 3.21 1.16.09 2.34-.59 3.07-1.46z" />
    </svg>
  );
}

export function SocialButtons() {
  const notImplemented = (provider: string) =>
    toast.info(`${provider} sign-in is not wired up in this template yet.`);

  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        type="button"
        variant="outline"
        onClick={() => notImplemented("Google")}
      >
        <GoogleIcon />
        Google
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => notImplemented("Apple")}
      >
        <AppleIcon />
        Apple
      </Button>
    </div>
  );
}

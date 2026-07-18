"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ShieldX } from "lucide-react";
import { usersApi } from "@/lib/api/users";
import { useAuth } from "@/lib/auth/context";
import { resolveUserFeatures } from "@/lib/auth/features";
import { canAccessRoute, getAuthenticatedLandingPath } from "@/lib/auth/roles";
import {
  parseUnauthorizedAccessContext,
  shouldShowStaleSessionHint,
} from "@/lib/auth/unauthorized-access";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function FeatureList({
  features,
  highlight,
}: {
  features: readonly string[];
  highlight?: string | null;
}) {
  if (features.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No privileges assigned.</p>
    );
  }

  const sorted = [...features].sort((a, b) => a.localeCompare(b));

  return (
    <ul className="flex flex-wrap gap-2">
      {sorted.map((feature) => (
        <li key={feature}>
          <Badge
            variant={feature === highlight ? "destructive" : "secondary"}
          >
            {feature}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

export default function AdminUnauthorizedPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const context = useMemo(
    () => parseUnauthorizedAccessContext(searchParams),
    [searchParams],
  );
  const recoveryAttemptedRef = useRef(false);
  const [sessionSnapshot, setSessionSnapshot] = useState<string[] | null>(null);
  const [freshFeatures, setFreshFeatures] = useState<string[] | null>(null);

  const sessionFeatures = useMemo(
    () => resolveUserFeatures(user),
    [user],
  );

  useEffect(() => {
    if (!user || sessionSnapshot !== null) return;
    setSessionSnapshot(sessionFeatures);
  }, [sessionFeatures, sessionSnapshot, user]);

  const effectiveSessionSnapshot = sessionSnapshot ?? sessionFeatures;

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    void (async () => {
      try {
        const { data } = await usersApi.get(user.id);
        if (cancelled) return;
        setFreshFeatures(resolveUserFeatures(data));
        await refreshUser();
      } catch {
        // Keep the page usable when the refresh request fails.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshUser, user]);

  const effectiveFreshFeatures = freshFeatures ?? effectiveSessionSnapshot;
  const hasContext = Boolean(
    context.attemptedPath || context.requiredFeature || context.routeLabel,
  );
  const missingRequiredFeature = Boolean(
    context.requiredFeature &&
      !sessionFeatures.includes(context.requiredFeature),
  );
  const staleSessionHint = shouldShowStaleSessionHint(
    context.requiredFeature,
    effectiveSessionSnapshot,
    effectiveFreshFeatures,
  );
  const isRecoverableStaleDeny = Boolean(
    context.attemptedPath &&
      context.requiredFeature &&
      sessionFeatures.includes(context.requiredFeature),
  );
  const canRecoverToAttemptedPath = Boolean(
    user &&
      context.attemptedPath &&
      canAccessRoute(context.attemptedPath, user),
  );
  const fallback = user ? getAuthenticatedLandingPath(user) : "/dashboard";
  const cardDescription = isRecoverableStaleDeny
    ? "Your session was out of sync — retrying access."
    : hasContext
      ? "This page requires a privilege that is not in your current session."
      : "You do not have permission to view this page.";

  useEffect(() => {
    if (!isRecoverableStaleDeny || !canRecoverToAttemptedPath) return;
    if (!context.attemptedPath) return;
    if (recoveryAttemptedRef.current) return;

    recoveryAttemptedRef.current = true;
    router.replace(context.attemptedPath);
  }, [
    canRecoverToAttemptedPath,
    context.attemptedPath,
    isRecoverableStaleDeny,
    router,
  ]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <ShieldX className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Access denied</CardTitle>
          <CardDescription>{cardDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {hasContext ? (
            <>
              <section className="space-y-1">
                <h2 className="text-sm font-medium">Page requested</h2>
                {context.routeLabel ? (
                  <p className="text-sm">
                    <span className="font-medium">{context.routeLabel}</span>
                    {context.attemptedPath ? (
                      <span className="text-muted-foreground">
                        {" "}
                        ({context.attemptedPath})
                      </span>
                    ) : null}
                  </p>
                ) : context.attemptedPath ? (
                  <p className="font-mono text-sm">{context.attemptedPath}</p>
                ) : null}
              </section>

              {context.requiredFeature ? (
                <section className="space-y-1">
                  <h2 className="text-sm font-medium">Required privilege</h2>
                  <Badge variant="outline">{context.requiredFeature}</Badge>
                  {missingRequiredFeature ? (
                    <p className="text-sm text-muted-foreground">
                      This privilege is not in your current session.
                    </p>
                  ) : null}
                </section>
              ) : null}

              <section className="space-y-2">
                <h2 className="text-sm font-medium">Your current privileges</h2>
                <FeatureList features={sessionFeatures} />
              </section>

              {staleSessionHint ? (
                <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    Your privileges were updated — refresh the page or wait for
                    session sync to access this page.
                  </p>
                </div>
              ) : null}
            </>
          ) : null}

          <div className="flex justify-center gap-3 pt-1">
            {isRecoverableStaleDeny && canRecoverToAttemptedPath && context.attemptedPath ? (
              <Link href={context.attemptedPath} className={buttonVariants()}>
                Continue to page
              </Link>
            ) : isRecoverableStaleDeny && !canRecoverToAttemptedPath ? (
              <button
                type="button"
                className={buttonVariants()}
                onClick={() => void refreshUser()}
              >
                Refresh page
              </button>
            ) : (
              <Link href={fallback} className={buttonVariants()}>
                Go to your dashboard
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { useAuth } from "@/lib/auth/context";
import {
  hasAnyFeature as checkAnyFeature,
  hasFeature as checkFeature,
  resolveUserFeatures,
} from "@/lib/auth/features";

export function useFeatures() {
  const { user } = useAuth();

  return useMemo(() => {
    const features = resolveUserFeatures(user);
    return {
      features,
      hasFeature: (key: string) => checkFeature(user, key),
      hasAnyFeature: (keys: string[]) => checkAnyFeature(user, keys),
    };
  }, [user]);
}

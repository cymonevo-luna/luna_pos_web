"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getRoleFeatures,
  listFeatures,
  updateRoleFeatures,
} from "@/lib/api/role-features";
import { ApiError } from "@/lib/api/client";
import type { Feature, MerchantRole } from "@/lib/api/types";
import {
  ASSIGNABLE_ROLES,
  formatRoleLabel,
} from "@/lib/auth/roles";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type RoleFeatureState = Record<MerchantRole, string[]>;

const FEATURE_CATEGORIES: Feature["category"][] = ["admin", "pos"];

const CATEGORY_LABELS: Record<Feature["category"], string> = {
  admin: "Admin dashboard",
  pos: "POS mobile app",
};

function emptyRoleFeatureState(): RoleFeatureState {
  return {
    admin: [],
    manager: [],
    cashier: [],
    operational: [],
  };
}

function mappingsToState(
  mappings: { role: MerchantRole; features: string[] }[],
): RoleFeatureState {
  const state = emptyRoleFeatureState();
  for (const mapping of mappings) {
    state[mapping.role] = [...mapping.features];
  }
  return state;
}

function featureSetsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

function groupFeaturesByCategory(features: Feature[]) {
  const grouped: Record<Feature["category"], Feature[]> = {
    admin: [],
    pos: [],
  };

  for (const feature of features) {
    grouped[feature.category].push(feature);
  }

  for (const category of FEATURE_CATEGORIES) {
    grouped[category].sort((a, b) => a.sort_order - b.sort_order);
  }

  return grouped;
}

export default function AdminRoleFeaturesPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [roleFeatures, setRoleFeatures] = useState<RoleFeatureState>(
    emptyRoleFeatureState,
  );
  const [savedRoleFeatures, setSavedRoleFeatures] = useState<RoleFeatureState>(
    emptyRoleFeatureState,
  );
  const [savingRole, setSavingRole] = useState<MerchantRole | null>(null);

  const groupedFeatures = useMemo(
    () => groupFeaturesByCategory(features),
    [features],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [featuresResult, mappingsResult] = await Promise.all([
        listFeatures(),
        getRoleFeatures(),
      ]);
      const nextFeatures = featuresResult.data ?? [];
      const nextMappings = mappingsToState(mappingsResult.data ?? []);
      setFeatures(nextFeatures);
      setRoleFeatures(nextMappings);
      setSavedRoleFeatures(nextMappings);
    } catch (err) {
      setLoadError(
        err instanceof ApiError
          ? err.message
          : "Failed to load privilege mapping",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleFeature = (role: MerchantRole, featureKey: string) => {
    setRoleFeatures((current) => {
      const enabled = current[role].includes(featureKey);
      const nextFeatures = enabled
        ? current[role].filter((key) => key !== featureKey)
        : [...current[role], featureKey];
      return { ...current, [role]: nextFeatures };
    });
  };

  const saveRole = async (role: MerchantRole) => {
    const nextFeatures = roleFeatures[role];
    setSavingRole(role);
    try {
      const result = await updateRoleFeatures(role, nextFeatures);
      const persisted = result.data?.features ?? nextFeatures;
      const nextSaved = { ...savedRoleFeatures, [role]: [...persisted] };
      const nextRoleFeatures = { ...roleFeatures, [role]: [...persisted] };
      setSavedRoleFeatures(nextSaved);
      setRoleFeatures(nextRoleFeatures);
      toast.success(`${formatRoleLabel(role)} privileges saved`);
    } catch (err) {
      setRoleFeatures((current) => ({
        ...current,
        [role]: [...savedRoleFeatures[role]],
      }));
      toast.error(
        err instanceof ApiError
          ? err.message
          : `Failed to save ${formatRoleLabel(role).toLowerCase()} privileges`,
      );
    } finally {
      setSavingRole(null);
    }
  };

  const columnCount = ASSIGNABLE_ROLES.length + 1;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Privilege Mapping</h2>
        <p className="text-muted-foreground">
          Configure which features each role can access in the admin dashboard
          and POS mobile app.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="min-w-56 px-4 py-3 font-medium">Feature</th>
                {ASSIGNABLE_ROLES.map((role) => {
                  const isDirty = !featureSetsEqual(
                    roleFeatures[role],
                    savedRoleFeatures[role],
                  );
                  return (
                    <th
                      key={role}
                      className="min-w-32 px-4 py-3 text-center font-medium"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <span>{formatRoleLabel(role)}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!isDirty || savingRole !== null}
                          isLoading={savingRole === role}
                          onClick={() => void saveRole(role)}
                        >
                          Save
                        </Button>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <tr key={index} className="border-b border-border">
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-40" />
                    </td>
                    {ASSIGNABLE_ROLES.map((role) => (
                      <td key={role} className="px-4 py-3 text-center">
                        <Skeleton className="mx-auto h-4 w-4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : loadError ? (
                <tr>
                  <td
                    colSpan={columnCount}
                    className="px-4 py-8 text-center text-destructive"
                  >
                    <div className="space-y-3">
                      <p>{loadError}</p>
                      <Button variant="outline" onClick={() => void load()}>
                        Retry
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : features.length === 0 ? (
                <tr>
                  <td
                    colSpan={columnCount}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No features are registered yet.
                  </td>
                </tr>
              ) : (
                FEATURE_CATEGORIES.flatMap((category) => {
                  const categoryFeatures = groupedFeatures[category];
                  if (categoryFeatures.length === 0) {
                    return [];
                  }

                  return [
                    <tr
                      key={`category-${category}`}
                      className="border-b border-border bg-muted/30"
                    >
                      <td
                        colSpan={columnCount}
                        className="px-4 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                      >
                        {CATEGORY_LABELS[category]}
                      </td>
                    </tr>,
                    ...categoryFeatures.map((feature) => (
                      <tr
                        key={feature.key}
                        className="border-b border-border hover:bg-muted/30"
                      >
                        <td className="px-4 py-3">
                          <div
                            className="font-medium"
                            title={
                              feature.description
                                ? `${feature.key} — ${feature.description}`
                                : feature.key
                            }
                          >
                            {feature.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {feature.key}
                          </div>
                        </td>
                        {ASSIGNABLE_ROLES.map((role) => {
                          const checkboxId = `${role}-${feature.key}`;
                          return (
                            <td key={role} className="px-4 py-3 text-center">
                              <input
                                id={checkboxId}
                                type="checkbox"
                                className="border-input h-4 w-4 rounded border"
                                checked={roleFeatures[role].includes(
                                  feature.key,
                                )}
                                disabled={savingRole !== null}
                                onChange={() =>
                                  toggleFeature(role, feature.key)
                                }
                                aria-label={`${feature.name} for ${formatRoleLabel(role)}`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    )),
                  ];
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

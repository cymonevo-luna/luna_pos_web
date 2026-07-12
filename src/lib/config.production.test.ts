import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../..");

function readEnvValue(fileName: string, key: string): string | undefined {
  const content = readFileSync(resolve(repoRoot, fileName), "utf8");
  const match = content.match(new RegExp(`^${key}=(.+)$`, "m"));
  return match?.[1]?.trim();
}

describe("production API configuration", () => {
  it(".env.production targets pos-api without a trailing slash", () => {
    expect(readEnvValue(".env.production", "NEXT_PUBLIC_API_URL")).toBe(
      "https://pos-api.cymonevo.com",
    );
  });

  it("Dockerfile defaults NEXT_PUBLIC_API_URL to pos-api for production builds", () => {
    const dockerfile = readFileSync(resolve(repoRoot, "Dockerfile"), "utf8");
    expect(dockerfile).toMatch(
      /ARG NEXT_PUBLIC_API_URL=https:\/\/pos-api\.cymonevo\.com/,
    );
  });

  it("refresh-daemon.sh falls back to .env.production for NEXT_PUBLIC_* build args", () => {
    const script = readFileSync(
      resolve(repoRoot, "scripts/refresh-daemon.sh"),
      "utf8",
    );
    expect(script).toContain('"$REPO_DIR/.env.production"');
  });
});

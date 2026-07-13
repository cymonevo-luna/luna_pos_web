import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.join(__dirname, "..", "..");
const refreshDaemon = readFileSync(
  path.join(repoRoot, "scripts", "refresh-daemon.sh"),
  "utf8",
);
const dockerfile = readFileSync(path.join(repoRoot, "Dockerfile"), "utf8");

describe("refresh-daemon.sh deploy hardening", () => {
  it("serializes docker builds and uses host networking", () => {
    expect(refreshDaemon).toContain("acquire_build_lock");
    expect(refreshDaemon).toContain("flock -n 9");
    expect(refreshDaemon).toContain("DOCKER_BUILDKIT=1");
    expect(refreshDaemon).toContain("docker build --network=host");
  });
});

describe("Dockerfile build caching", () => {
  it("caches npm and next build output", () => {
    expect(dockerfile).toContain("--mount=type=cache,target=/root/.npm");
    expect(dockerfile).toContain("--mount=type=cache,target=/app/.next/cache");
    expect(dockerfile).toContain("--fetch-retries=5");
  });
});

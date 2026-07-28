import { logger } from "../utils/logger";
import type { ZigRelease } from "../types";
import { parseVersion, compareVersions } from "../utils/version";

const INDEX_URL = "https://ziglang.org/download/index.json";

let cachedIndex: Record<string, ZigRelease> | null = null;
let cacheTime = 0;
const CACHE_TTL = 300_000;

export async function fetchReleaseIndex(): Promise<Record<string, ZigRelease>> {
  if (cachedIndex && Date.now() - cacheTime < CACHE_TTL) {
    return cachedIndex;
  }

  logger.info("Fetching Zig release index");
  const response = await fetch(INDEX_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch release index: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as Record<string, ZigRelease>;
  cachedIndex = data;
  cacheTime = Date.now();

  logger.debug(`Fetched ${Object.keys(data).length} releases from index`);
  return data;
}

export function getLatestVersion(releases: Record<string, ZigRelease>): string {
  const versions = Object.keys(releases).sort((a, b) => {
    const pa = parseVersion(a);
    const pb = parseVersion(b);

    if (pa.major !== pb.major) return pb.major - pa.major;
    if (pa.minor !== pb.minor) return pb.minor - pa.minor;
    if (pa.patch !== pb.patch) return pb.patch - pa.patch;

    const order = { stable: 0, rc: 1, beta: 2, dev: 3 } as const;
    return (order[pa.channel] ?? 99) - (order[pb.channel] ?? 99);
  });

  return versions[0] ?? "";
}

export function getStableVersion(releases: Record<string, ZigRelease>): string | null {
  let latest: string | null = null;
  for (const version of Object.keys(releases)) {
    if (parseVersion(version).channel === "stable") {
      if (!latest || compareVersions(version, latest) > 0) {
        latest = version;
      }
    }
  }
  return latest;
}

export function getUnpublishedReleases(
  releases: Record<string, ZigRelease>,
  publishedVersions: string[],
): Record<string, ZigRelease> {
  return Object.fromEntries(
    Object.entries(releases).filter(
      ([version]) => isValidVersionKey(version) && !publishedVersions.includes(version),
    ),
  );
}

function isValidVersionKey(key: string): boolean {
  return /^\d/.test(key);
}

export function getReleasePlatforms(release: ZigRelease): string[] {
  return Object.keys(release.platforms);
}

export function clearReleaseCache(): void {
  cachedIndex = null;
  cacheTime = 0;
  logger.debug("Release cache cleared");
}

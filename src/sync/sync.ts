import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { logger } from "../utils/logger";
import { fetchReleaseIndex, getUnpublishedReleases } from "../releases/releases";
import { parseVersion, compareVersions } from "../utils/version";
import { downloadArchive } from "../download/download";
import { verifyArchive } from "../verify/verify";
import { extractArchive } from "../extract/extract";
import { generatePlatformPackage, generateRootPackage } from "../generate/generate";
import { SUPPORTED_PLATFORMS, getArchiveExtension } from "../utils/platform";
import { tempDir } from "../utils/file";
import type { SyncResult, ZigRelease } from "../types";

const PUBLISHED_VERSIONS_FILE = "published-versions.json";

export async function getPublishedVersions(): Promise<string[]> {
  if (!existsSync(PUBLISHED_VERSIONS_FILE)) {
    return [];
  }
  try {
    const data = await readFile(PUBLISHED_VERSIONS_FILE, "utf-8");
    return JSON.parse(data) as string[];
  } catch {
    return [];
  }
}

export async function savePublishedVersion(version: string): Promise<void> {
  const versions = await getPublishedVersions();
  if (!versions.includes(version)) {
    versions.push(version);
    versions.sort((a, b) => -compareVersions(a, b));
  }
  await writeFile(PUBLISHED_VERSIONS_FILE, JSON.stringify(versions, null, 2) + "\n");
}

export async function syncRelease(version: string, release: ZigRelease): Promise<SyncResult> {
  const parsed = parseVersion(version);
  logger.divider();
  logger.info(`Syncing release: ${version} (${parsed.channel})`);

  const tmpDir = tempDir();
  const succeeded: string[] = [];
  const failed: string[] = [];

  const platformPromises = SUPPORTED_PLATFORMS.map(async (platform) => {
    const archKey = platform.suffix.includes("macos")
      ? platform.suffix.replace("macos-", "")
      : platform.suffix.includes("windows")
        ? platform.suffix.replace("windows-", "")
        : platform.suffix.replace("linux-", "");

    const platformKey = Object.keys(release.platforms).find(
      (k) =>
        k.includes(archKey) &&
        ((platform.os === "darwin" && k.includes("macos")) ||
          (platform.os === "win32" && k.includes("windows")) ||
          (platform.os === "linux" && k.includes("linux"))),
    );

    if (!platformKey || !release.platforms[platformKey]) {
      logger.debug(`Platform ${platform.suffix} not available for ${version}`);
      return;
    }

    const platformRelease = release.platforms[platformKey];
    const ext = getArchiveExtension(platform.os);

    try {
      logger.info(`Processing ${platform.suffix}...`);

      const { archive, minisig } = await downloadArchive(version, platform.suffix, tmpDir, ext);

      const archiveName = `zig-${platform.suffix}-${version}.${ext}`;
      const verifyResult = await verifyArchive({
        archivePath: archive,
        minisigPath: minisig,
        expectedShasum: platformRelease.shasum,
        expectedFilename: archiveName,
        expectedVersion: version,
      });

      if (!verifyResult.valid) {
        failed.push(platform.suffix);
        logger.error(
          `Verification failed for ${platform.suffix}: ${verifyResult.errors.join(", ")}`,
        );
        return;
      }

      const extractDir = `${tmpDir}/extracted-${platform.suffix}`;
      await extractArchive({ archivePath: archive, destDir: extractDir, deleteArchive: true });

      await generatePlatformPackage(version, platform, extractDir);

      succeeded.push(platform.suffix);
      logger.info(`Completed ${platform.suffix}`);
    } catch (error) {
      failed.push(platform.suffix);
      logger.error(`Failed ${platform.suffix}: ${error}`);
    }
  });

  await Promise.all(platformPromises);

  if (succeeded.length > 0) {
    await generateRootPackage(version);
    await savePublishedVersion(version);
  }

  logger.info(`Sync complete: ${succeeded.length} succeeded, ${failed.length} failed`);

  return {
    version,
    published: failed.length === 0,
    platforms: succeeded,
  };
}

export async function syncAll(): Promise<SyncResult[]> {
  const releases = await fetchReleaseIndex();
  const published = await getPublishedVersions();
  const unpublished = getUnpublishedReleases(releases, published);

  if (Object.keys(unpublished).length === 0) {
    logger.info("No new releases to sync");
    return [];
  }

  logger.info(`Found ${Object.keys(unpublished).length} unpublished releases`);

  const results: SyncResult[] = [];
  for (const [version, release] of Object.entries(unpublished)) {
    const result = await syncRelease(version, release);
    results.push(result);
  }

  return results;
}

#!/usr/bin/env bun
import { logger } from "../utils/logger";
import { syncAll } from "../sync/sync";
import { verifyArchive } from "../verify/verify";
import { generateRootPackage, generatePlatformPackage } from "../generate/generate";
import { publishVersion } from "../publish/publish";
import { clearMirrorCache } from "../download/mirrors";
import { clearReleaseCache } from "../releases/releases";
import { getPublishedVersions } from "../sync/sync";
import { fetchReleaseIndex } from "../releases/releases";
import { SUPPORTED_PLATFORMS, getArchiveExtension } from "../utils/platform";
import { ensureDir, tempDir } from "../utils/file";
import { downloadFromMirrors } from "../download/download";
import { extractArchive } from "../extract/extract";
import type { CliCommand } from "../types";

const commands: Record<string, CliCommand> = {
  sync: {
    name: "sync",
    description: "Sync all unpublished Zig releases from the official index",
    run: async () => {
      const results = await syncAll();
      logger.info(`Sync completed: ${results.length} releases processed`);
    },
  },
  verify: {
    name: "verify",
    description: "Verify archive integrity (minisign + sha256)",
    run: async (args: string[]) => {
      const [archivePath, minisigPath] = args;
      if (!archivePath) {
        logger.error("Usage: zigpm verify <archive> [minisig]");
        return;
      }
      const result = await verifyArchive({
        archivePath,
        minisigPath: minisigPath || undefined,
      });
      if (result.valid) {
        logger.info("Verification passed");
      } else {
        logger.error("Verification failed");
        for (const err of result.errors) {
          logger.error(`  - ${err}`);
        }
      }
    },
  },
  generate: {
    name: "generate",
    description: "Generate packages for the latest synced release",
    run: async (args: string[]) => {
      const versionArg = args[0];
      if (versionArg) {
        const releases = await fetchReleaseIndex();
        const release = releases[versionArg];
        if (!release) {
          logger.error(`Release ${versionArg} not found`);
          return;
        }

        const tmpDir = tempDir();

        for (const platform of SUPPORTED_PLATFORMS) {
          const archKey = platform.suffix.includes("macos")
            ? platform.suffix.replace("macos-", "")
            : platform.suffix.includes("windows")
              ? platform.suffix.replace("windows-", "")
              : platform.suffix.replace("linux-", "");
          const ext = getArchiveExtension(platform.os);

          const platformKey = Object.keys(release.platforms).find((k) => k.includes(archKey));
          if (!platformKey) continue;

          const platformRelease = release.platforms[platformKey];
          const archiveName = `zig-${platform.suffix}-${versionArg}.${ext}`;

          try {
            const archive = await downloadFromMirrors(archiveName, `${tmpDir}/${archiveName}`);
            const extractDir = `${tmpDir}/extracted-${platform.suffix}`;
            await extractArchive({
              archivePath: archive,
              destDir: extractDir,
              deleteArchive: true,
            });
            await generatePlatformPackage(versionArg, platform, extractDir);
          } catch (error) {
            logger.error(`Failed to generate ${platform.suffix}: ${error}`);
          }
        }

        await generateRootPackage(versionArg);
      } else {
        const published = await getPublishedVersions();
        if (published.length === 0) {
          logger.info('No published versions found. Run "zigpm sync" first.');
          return;
        }
        const latest = published[0];
        logger.info(`Latest published version: ${latest}`);
      }
    },
  },
  publish: {
    name: "publish",
    description: "Publish packages to npm",
    run: async (args: string[]) => {
      const version = args[0];
      const dryRun = args.includes("--dry-run");
      if (!version) {
        logger.error("Usage: zigpm publish <version> [--dry-run]");
        return;
      }
      await publishVersion(version, { dryRun });
    },
  },
  clean: {
    name: "clean",
    description: "Clean generated packages and temporary files",
    run: async () => {
      await cleanAll();
      logger.info("Clean completed");
    },
  },
  list: {
    name: "list",
    description: "List published versions",
    run: async () => {
      const published = await getPublishedVersions();
      if (published.length === 0) {
        logger.info("No published versions");
        return;
      }
      logger.info(`Published versions (${published.length}):`);
      for (const v of published) {
        logger.info(`  ${v}`);
      }
    },
  },
};

async function cleanAll(): Promise<void> {
  const { rm } = await import("fs/promises");
  const { existsSync } = await import("fs");
  const { join } = await import("path");
  const { readdir } = await import("fs/promises");

  const packagesDir = "packages";
  if (existsSync(packagesDir)) {
    const entries = await readdir(packagesDir);
    for (const entry of entries) {
      if (entry !== ".published.json") {
        const fullPath = join(packagesDir, entry);
        await rm(fullPath, { recursive: true, force: true });
      }
    }
  }

  clearMirrorCache();
  clearReleaseCache();
}

async function main() {
  const args = process.argv.slice(2);
  const commandName = args[0]?.toLowerCase() ?? "help";

  if (commandName === "help" || !commands[commandName]) {
    logger.info("zigpm — Zig Package Manager for npm");
    logger.info("");
    logger.info("Usage: zigpm <command> [options]");
    logger.info("");
    logger.info("Commands:");
    for (const cmd of Object.values(commands)) {
      logger.info(`  ${cmd.name.padEnd(12)} ${cmd.description}`);
    }
    return;
  }

  try {
    await commands[commandName].run(args.slice(1));
  } catch (error) {
    logger.error(
      `Command "${commandName}" failed: ${error instanceof Error ? error.message : error}`,
    );
    process.exit(1);
  }
}

await main();

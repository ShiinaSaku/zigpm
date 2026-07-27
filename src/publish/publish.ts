import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';
import { getPlatformPackageName, SUPPORTED_PLATFORMS } from '../utils/platform';
import type { PackageConfig } from '../types';

const ROOT_PACKAGE_NAME = '@zigpm/zig';
const NPM_REGISTRY = 'https://registry.npmjs.org';

export interface PublishOptions {
  dryRun?: boolean;
  otp?: string;
  tag?: string;
}

export async function publishVersion(version: string, options: PublishOptions = {}): Promise<void> {
  const { dryRun = false, tag = getNpmTag(version) } = options;

  logger.divider();
  logger.info(`Publishing ${ROOT_PACKAGE_NAME}@${version} (tag: ${tag})${dryRun ? ' [DRY RUN]' : ''}`);

  const missing = findMissingPlatforms(version);
  if (missing.length > 0) {
    logger.warn(`Missing platform packages: ${missing.join(', ')}`);
  }

  const platformPackages = SUPPORTED_PLATFORMS.map(p => getPlatformPackageName(p));

  for (const pkgName of platformPackages) {
    const pkgDir = `packages/${pkgName}`;
    if (!existsSync(pkgDir)) {
      logger.warn(`Skipping missing package: ${pkgName}`);
      continue;
    }
    await publishPackage(pkgName, pkgDir, version, tag, dryRun);
  }

  const rootDir = 'packages/root';
  if (existsSync(rootDir)) {
    await publishPackage(ROOT_PACKAGE_NAME, rootDir, version, tag, dryRun);
  }

  logger.info(`Publishing complete for ${ROOT_PACKAGE_NAME}@${version}`);
}

async function publishPackage(
  name: string,
  dir: string,
  version: string,
  tag: string,
  dryRun: boolean,
): Promise<void> {
  const packageJsonPath = join(dir, 'package.json');
  if (!existsSync(packageJsonPath)) {
    logger.warn(`No package.json found in ${dir}`);
    return;
  }

  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8')) as PackageConfig;

  if (await isPublished(name, version)) {
    logger.info(`Already published: ${name}@${version}`);
    return;
  }

  logger.info(`Publishing ${name}@${version}`);

  if (dryRun) {
    logger.info(`[DRY RUN] Would publish ${name}@${version}`);
    return;
  }

  const result = await npmPublish(dir, tag);
  if (result) {
    logger.info(`Published ${name}@${version}`);
  } else {
    throw new Error(`Failed to publish ${name}@${version}`);
  }
}

async function isPublished(name: string, version: string): Promise<boolean> {
  try {
    const response = await fetch(`${NPM_REGISTRY}/${name}/${version}`);
    if (response.status === 200) {
      const data = await response.json();
      return data.version === version;
    }
    return false;
  } catch {
    return false;
  }
}

async function npmPublish(dir: string, tag: string): Promise<boolean> {
  const proc = Bun.spawnSync(['npm', 'publish', '--provenance', '--tag', tag, '--access', 'public'], {
    cwd: dir,
  });

  if (proc.exitCode !== 0) {
    logger.error(`npm publish failed: ${proc.stderr.toString()}`);
    return false;
  }

  return true;
}

function getNpmTag(version: string): string {
  if (version.includes('-dev')) return 'dev';
  if (version.includes('-beta')) return 'beta';
  if (version.includes('-rc')) return 'rc';
  return 'latest';
}

function findMissingPlatforms(version: string): string[] {
  const missing: string[] = [];
  for (const platform of SUPPORTED_PLATFORMS) {
    const pkgName = getPlatformPackageName(platform);
    const pkgDir = `packages/${pkgName}`;
    if (!existsSync(pkgDir)) {
      missing.push(pkgName);
    }
  }
  return missing;
}

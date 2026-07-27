import { mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';

export type ArchiveFormat = 'tar.xz' | 'tar.gz' | 'zip';

export function detectFormat(filePath: string): ArchiveFormat {
  if (filePath.endsWith('.tar.xz')) return 'tar.xz';
  if (filePath.endsWith('.tar.gz') || filePath.endsWith('.tgz')) return 'tar.gz';
  if (filePath.endsWith('.zip')) return 'zip';
  throw new Error(`Unknown archive format: ${filePath}`);
}

export interface ExtractOptions {
  archivePath: string;
  destDir: string;
  stripComponents?: number;
  deleteArchive?: boolean;
}

export async function extractArchive(options: ExtractOptions): Promise<string> {
  const { archivePath, destDir, stripComponents = 1, deleteArchive = true } = options;

  if (!existsSync(archivePath)) {
    throw new Error(`Archive not found: ${archivePath}`);
  }

  await mkdir(destDir, { recursive: true });

  const format = detectFormat(archivePath);
  logger.info(`Extracting ${archivePath} (${format}) to ${destDir}`);

  switch (format) {
    case 'tar.xz':
      await extractTarXz(archivePath, destDir, stripComponents);
      break;
    case 'tar.gz':
      await extractTarGz(archivePath, destDir, stripComponents);
      break;
    case 'zip':
      await extractZip(archivePath, destDir, stripComponents);
      break;
  }

  if (deleteArchive) {
    await unlink(archivePath).catch(() => {});
    logger.debug(`Deleted archive: ${archivePath}`);
  }

  return destDir;
}

async function extractTarXz(archivePath: string, destDir: string, stripComponents: number): Promise<void> {
  const stripArg = stripComponents > 0 ? [`--strip-components=${stripComponents}`] : [];
  const proc = Bun.spawnSync(['tar', '-xJf', archivePath, '-C', destDir, ...stripArg]);
  if (proc.exitCode !== 0) {
    throw new Error(`tar extraction failed: ${proc.stderr.toString() || 'unknown error'}`);
  }
}

async function extractTarGz(archivePath: string, destDir: string, stripComponents: number): Promise<void> {
  const stripArg = stripComponents > 0 ? [`--strip-components=${stripComponents}`] : [];
  const proc = Bun.spawnSync(['tar', '-xzf', archivePath, '-C', destDir, ...stripArg]);
  if (proc.exitCode !== 0) {
    throw new Error(`tar.gz extraction failed: ${proc.stderr.toString() || 'unknown error'}`);
  }
}

async function extractZip(archivePath: string, destDir: string, stripComponents: number): Promise<void> {
  if (stripComponents > 0) {
    const tmpDir = join(destDir, '..', '_tmp_extract_' + Date.now());
    await mkdir(tmpDir, { recursive: true });

    const proc = Bun.spawnSync(['unzip', '-o', archivePath, '-d', tmpDir]);
    if (proc.exitCode !== 0) {
      throw new Error(`unzip extraction failed: ${proc.stderr.toString() || 'unknown error'}`);
    }

    const entries = await readdir(tmpDir);
    const topDir = entries.length === 1 ? join(tmpDir, entries[0]) : tmpDir;
    await moveContents(topDir, destDir);
    await unlink(tmpDir).catch(() => {});
  } else {
    const proc = Bun.spawnSync(['unzip', '-o', archivePath, '-d', destDir]);
    if (proc.exitCode !== 0) {
      throw new Error(`unzip extraction failed: ${proc.stderr.toString() || 'unknown error'}`);
    }
  }
}

async function readdir(dir: string): Promise<string[]> {
  const { readdir } = await import('fs/promises');
  return readdir(dir);
}

async function moveContents(src: string, dest: string): Promise<void> {
  const { readdir, rename } = await import('fs/promises');
  const entries = await readdir(src);
  await Promise.all(entries.map(entry => rename(join(src, entry), join(dest, entry))));
}

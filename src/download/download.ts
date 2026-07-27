import { createWriteStream, existsSync } from "fs";
import { unlink } from "fs/promises";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { logger } from "../utils/logger";
import { fetchMirrors, shuffleMirrors } from "./mirrors";
import type { Mirror } from "../types";

export interface DownloadOptions {
  url: string;
  dest: string;
  retries?: number;
  timeout?: number;
  expectedSize?: number;
}

export async function downloadFile(options: DownloadOptions): Promise<string> {
  const { url, dest, retries = 3, timeout = 120_000 } = options;

  if (existsSync(dest)) {
    logger.debug(`File already exists, skipping download: ${dest}`);
    return dest;
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.info(`Downloading ${url} (attempt ${attempt}/${retries})`);
      const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error("Response body is null");
      }

      const fileStream = createWriteStream(dest);
      await pipeline(Readable.fromWeb(response.body as never), fileStream);

      logger.debug(`Downloaded to ${dest}`);
      return dest;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn(`Download failed (attempt ${attempt}/${retries}): ${lastError.message}`);

      if (existsSync(dest)) {
        await unlink(dest).catch(() => {});
      }

      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10_000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError ?? new Error("Download failed after all retries");
}

export async function downloadFromMirrors(
  path: string,
  dest: string,
  options?: { retries?: number; timeout?: number },
): Promise<string> {
  const mirrors = await fetchMirrors();
  const shuffled = shuffleMirrors(mirrors);

  const maxRetries = options?.retries ?? 3;
  let attempt = 0;

  for (const mirror of shuffled) {
    attempt++;
    if (attempt > maxRetries) break;

    const url = `${mirror.url}/${path}`;
    try {
      return await downloadFile({
        url,
        dest,
        retries: 1,
        timeout: options?.timeout,
      });
    } catch (error) {
      logger.warn(`Mirror ${mirror.url} failed: ${error instanceof Error ? error.message : error}`);
      continue;
    }
  }

  const directUrl = `https://ziglang.org/download/${path}`;
  logger.info("All mirrors failed, trying direct download");
  return await downloadFile({
    url: directUrl,
    dest,
    retries: 2,
    timeout: options?.timeout,
  });
}

export async function downloadArchive(
  version: string,
  platformSuffix: string,
  destDir: string,
  ext: string,
): Promise<{ archive: string; minisig: string }> {
  const archiveName = `zig-${platformSuffix}-${version}.${ext}`;
  const minisigName = `${archiveName}.minisig`;
  const archivePath = `${destDir}/${archiveName}`;
  const minisigPath = `${destDir}/${minisigName}`;

  const archiveUrl = `zig-${platformSuffix}-${version}.${ext}`;
  const minisigUrl = `${archiveUrl}.minisig`;

  const [archive, minisig] = await Promise.all([
    downloadFromMirrors(archiveUrl, archivePath),
    downloadFromMirrors(minisigUrl, minisigPath),
  ]);

  return { archive, minisig };
}

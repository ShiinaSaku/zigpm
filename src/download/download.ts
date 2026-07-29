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
  filename: string,
  dest: string,
  options?: { retries?: number; timeout?: number; version?: string },
): Promise<string> {
  const mirrors = await fetchMirrors();
  const shuffled = shuffleMirrors(mirrors);
  const source = "zigpm";

  const maxRetries = options?.retries ?? 3;
  let attempt = 0;

  for (const mirror of shuffled) {
    attempt++;
    if (attempt > maxRetries) break;

    const url = `${mirror.url}/${filename}?source=${source}`;
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

  const version = options?.version ?? "";
  const directUrl = `https://ziglang.org/download/${version}/${filename}`;
  logger.info("All mirrors failed, trying direct download");
  return await downloadFile({
    url: directUrl,
    dest,
    retries: 2,
    timeout: options?.timeout,
  });
}

export async function downloadArchive(
  tarballUrl: string,
  destDir: string,
): Promise<{ archive: string; minisig: string }> {
  const url = new URL(tarballUrl);
  const archiveName = url.pathname.split("/").pop()!;
  const minisigName = `${archiveName}.minisig`;
  const archivePath = `${destDir}/${archiveName}`;
  const minisigPath = `${destDir}/${minisigName}`;

  const pathParts = url.pathname.split("/");
  const version = pathParts[pathParts.length - 2] ?? "";

  const [archive, minisig] = await Promise.all([
    downloadFromMirrors(archiveName, archivePath, { version }),
    downloadFromMirrors(minisigName, minisigPath, { version }),
  ]);

  return { archive, minisig };
}

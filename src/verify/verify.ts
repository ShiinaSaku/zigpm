import { createHash } from "crypto";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { logger } from "../utils/logger";
import { verifyMinisign } from "./minisign";
import type { VerifyResult } from "../types";

export interface VerifyOptions {
  archivePath: string;
  minisigPath?: string;
  expectedShasum?: string;
  expectedFilename?: string;
  expectedVersion?: string;
}

export async function verifyArchive(options: VerifyOptions): Promise<VerifyResult> {
  const { archivePath, minisigPath, expectedShasum, expectedFilename, expectedVersion } = options;
  const errors: string[] = [];
  const result: VerifyResult = {
    valid: true,
    sha256Match: false,
    signatureValid: false,
    filenameMatch: false,
    errors,
  };

  if (!existsSync(archivePath)) {
    errors.push(`Archive not found: ${archivePath}`);
    result.valid = false;
    return result;
  }

  const actualFilename = archivePath.split("/").pop() ?? "";
  if (expectedFilename) {
    result.filenameMatch = actualFilename === expectedFilename;
    if (!result.filenameMatch) {
      errors.push(`Filename mismatch: expected "${expectedFilename}", got "${actualFilename}"`);
    }
  }

  if (expectedShasum) {
    try {
      const actualShasum = await computeSha256(archivePath);
      result.sha256Match = actualShasum.toLowerCase() === expectedShasum.toLowerCase();
      if (!result.sha256Match) {
        errors.push(`SHA256 mismatch: expected "${expectedShasum}", got "${actualShasum}"`);
      }
    } catch (error) {
      errors.push(`SHA256 computation failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  if (minisigPath && existsSync(minisigPath)) {
    try {
      result.signatureValid = await verifyMinisign(archivePath, minisigPath);
      if (!result.signatureValid) {
        errors.push("Minisign signature verification failed");
      }
    } catch (error) {
      errors.push(`Minisign verification error: ${error instanceof Error ? error.message : error}`);
    }
  }

  if (expectedVersion && result.sha256Match && result.signatureValid) {
    logger.info(`Verified ${actualFilename} (version ${expectedVersion})`);
  }

  result.valid = errors.length === 0;
  return result;
}

async function computeSha256(filePath: string): Promise<string> {
  const fileBuffer = await readFile(filePath);
  return createHash("sha256").update(fileBuffer).digest("hex");
}

export function createSignatureUrl(archiveUrl: string): string {
  return `${archiveUrl}.minisig`;
}

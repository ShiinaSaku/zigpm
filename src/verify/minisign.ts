import { createHash } from "crypto";
import { readFile } from "fs/promises";
import { logger } from "../utils/logger";

const PUBLIC_KEY_BASE64 = "RWSGOq2NcAEF11d8g3NRnZiz0eQJ9w2LmP8z5Fn0fTsZx7mz3j5gG4c";

async function parseKey(): Promise<{ id: Buffer; key: CryptoKey }> {
  const keyInfo = Buffer.from(PUBLIC_KEY_BASE64, "base64");
  const id = keyInfo.subarray(2, 10);
  const rawKey = keyInfo.subarray(10);
  const key = await crypto.subtle.importKey("raw", rawKey, "Ed25519", false, ["verify"]);
  return { id, key };
}

function parseSignature(sigBuf: Buffer) {
  const untrustedHeader = Buffer.from("untrusted comment: ");
  const trustedHeader = Buffer.from("trusted comment: ");

  if (!sigBuf.subarray(0, untrustedHeader.length).equals(untrustedHeader)) return null;
  sigBuf = sigBuf.subarray(untrustedHeader.length);

  const untrustedEnd = sigBuf.indexOf("\n");
  if (untrustedEnd === -1) return null;
  sigBuf = sigBuf.subarray(untrustedEnd + 1);

  const sigInfoEnd = sigBuf.indexOf("\n");
  if (sigInfoEnd === -1) return null;
  const sigInfo = Buffer.from(sigBuf.subarray(0, sigInfoEnd).toString(), "base64");
  sigBuf = sigBuf.subarray(sigInfoEnd + 1);

  const algorithm = sigInfo.subarray(0, 2);
  const keyId = sigInfo.subarray(2, 10);
  const signature = sigInfo.subarray(10);

  if (!sigBuf.subarray(0, trustedHeader.length).equals(trustedHeader)) return null;
  sigBuf = sigBuf.subarray(trustedHeader.length);

  const trustedEnd = sigBuf.indexOf("\n");
  if (trustedEnd === -1) return null;
  const trustedComment = sigBuf.subarray(0, trustedEnd);
  sigBuf = sigBuf.subarray(trustedEnd + 1);

  let globalSigEnd = sigBuf.indexOf("\n");
  if (globalSigEnd === -1) globalSigEnd = sigBuf.length;
  const globalSignature = Buffer.from(sigBuf.subarray(0, globalSigEnd).toString(), "base64");

  return { algorithm, keyId, signature, trustedComment, globalSignature };
}

export async function verifyMinisign(archivePath: string, minisigPath: string): Promise<boolean> {
  try {
    const pubkey = await parseKey();
    const sigContent = await readFile(minisigPath);
    const sig = parseSignature(sigContent);
    if (!sig) return false;

    if (!sig.keyId.equals(pubkey.id)) return false;

    const fileContent = await readFile(archivePath);

    let signedContent: Buffer;
    if (sig.algorithm.equals(Buffer.from("ED"))) {
      signedContent = createHash("BLAKE2b512").update(fileContent).digest();
    } else if (sig.algorithm.equals(Buffer.from("Ed"))) {
      signedContent = fileContent;
    } else {
      return false;
    }

    if (!(await crypto.subtle.verify("Ed25519", pubkey.key, new Uint8Array(sig.signature), new Uint8Array(signedContent)))) {
      return false;
    }

    const globalSignedContent = Buffer.concat([sig.signature, sig.trustedComment]);
    if (
      !(await crypto.subtle.verify(
        "Ed25519",
        pubkey.key,
        new Uint8Array(sig.globalSignature),
        new Uint8Array(globalSignedContent),
      ))
    ) {
      return false;
    }

    return true;
  } catch (error) {
    logger.warn(`Minisign verification error: ${error}`);
    return false;
  }
}
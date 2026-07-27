import { logger } from "../utils/logger";
import type { Mirror } from "../types";

const MIRRORS_URL = "https://ziglang.org/download/community-mirrors.txt";
const CACHE_KEY = "mirrors";
const CACHE_TTL = 3_600_000;

let cachedMirrors: Mirror[] | null = null;
let cacheTime = 0;

export async function fetchMirrors(): Promise<Mirror[]> {
  if (cachedMirrors && Date.now() - cacheTime < CACHE_TTL) {
    return cachedMirrors;
  }

  const response = await fetch(MIRRORS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch mirrors: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  const mirrors = parseMirrors(text);

  if (mirrors.length === 0) {
    throw new Error("No mirrors found in community-mirrors.txt");
  }

  cachedMirrors = mirrors;
  cacheTime = Date.now();
  logger.debug(`Fetched ${mirrors.length} mirrors from ${MIRRORS_URL}`);

  return mirrors;
}

function parseMirrors(text: string): Mirror[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((url) => ({ url: url.replace(/\/+$/, "") }));
}

export function shuffleMirrors(mirrors: Mirror[]): Mirror[] {
  const shuffled = [...mirrors];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function clearMirrorCache(): void {
  cachedMirrors = null;
  cacheTime = 0;
  logger.debug("Mirror cache cleared");
}

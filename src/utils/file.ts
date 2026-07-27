import { existsSync, mkdirSync } from 'fs';

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function tempDir(): string {
  const dir = `/tmp/zigpm-${crypto.randomUUID().slice(0, 8)}`;
  ensureDir(dir);
  return dir;
}

export function packageDir(version: string): string {
  return `packages/${version}`;
}

export function packageRootDir(): string {
  return 'packages/root';
}

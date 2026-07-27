export interface ZigRelease {
  version: string;
  date: string;
  docs: string;
  src: string | null;
  notes: string | null;
  published_at: string | null;
  platforms: Record<string, ZigPlatformRelease>;
}

export interface ZigPlatformRelease {
  tarball: string;
  shasum: string;
  size: string;
}

export interface ZigVersion {
  raw: string;
  semver: string;
  channel: 'stable' | 'beta' | 'rc' | 'dev';
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
}

export interface PlatformTriple {
  os: string;
  arch: string;
  npmOs: string[];
  npmCpu: string[];
  suffix: string;
  binaryName: string;
}

export interface Mirror {
  url: string;
  region?: string;
  priority?: number;
}

export interface PackageConfig {
  name: string;
  version: string;
  description: string;
  os: string[];
  cpu: string[];
  license: string;
  optionalDependencies?: Record<string, string>;
  bin?: Record<string, string>;
  dependencies?: Record<string, string>;
}

export interface DownloadResult {
  path: string;
  size: number;
  sha256: string;
}

export interface SyncResult {
  version: string;
  published: boolean;
  platforms: string[];
}

export interface VerifyResult {
  valid: boolean;
  sha256Match: boolean;
  signatureValid: boolean;
  filenameMatch: boolean;
  errors: string[];
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface CliCommand {
  name: string;
  description: string;
  run: (args: string[]) => Promise<void>;
}

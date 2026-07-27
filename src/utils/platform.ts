import type { PlatformTriple } from '../types';

export const SUPPORTED_PLATFORMS: PlatformTriple[] = [
  {
    os: 'linux',
    arch: 'x86_64',
    npmOs: ['linux'],
    npmCpu: ['x64'],
    suffix: 'linux-x86_64',
    binaryName: 'zig',
  },
  {
    os: 'linux',
    arch: 'aarch64',
    npmOs: ['linux'],
    npmCpu: ['arm64'],
    suffix: 'linux-aarch64',
    binaryName: 'zig',
  },
  {
    os: 'linux',
    arch: 'riscv64',
    npmOs: ['linux'],
    npmCpu: ['riscv64'],
    suffix: 'linux-riscv64',
    binaryName: 'zig',
  },
  {
    os: 'linux',
    arch: 'loongarch64',
    npmOs: ['linux'],
    npmCpu: ['loong64'],
    suffix: 'linux-loongarch64',
    binaryName: 'zig',
  },
  {
    os: 'darwin',
    arch: 'x86_64',
    npmOs: ['darwin'],
    npmCpu: ['x64'],
    suffix: 'macos-x86_64',
    binaryName: 'zig',
  },
  {
    os: 'darwin',
    arch: 'aarch64',
    npmOs: ['darwin'],
    npmCpu: ['arm64'],
    suffix: 'macos-aarch64',
    binaryName: 'zig',
  },
  {
    os: 'win32',
    arch: 'x86_64',
    npmOs: ['win32'],
    npmCpu: ['x64'],
    suffix: 'windows-x86_64',
    binaryName: 'zig.exe',
  },
  {
    os: 'win32',
    arch: 'aarch64',
    npmOs: ['win32'],
    npmCpu: ['arm64'],
    suffix: 'windows-aarch64',
    binaryName: 'zig.exe',
  },
];

export function getPlatformPackageName(platform: PlatformTriple): string {
  const archMap: Record<string, string> = {
    x86_64: 'x64',
    aarch64: 'arm64',
    riscv64: 'riscv64',
    loongarch64: 'loong64',
  };
  return `@zigpm/zig-${platform.os}-${archMap[platform.arch]}`;
}

export function getLocalPlatform(): PlatformTriple | null {
  const osMap: Record<string, string> = {
    linux: 'linux',
    darwin: 'darwin',
    win32: 'win32',
  };
  const archMap: Record<string, string> = {
    x64: 'x86_64',
    arm64: 'aarch64',
    riscv64: 'riscv64',
    loong64: 'loongarch64',
  };

  const os = osMap[process.platform];
  const arch = archMap[process.arch];

  if (!os || !arch) return null;

  return SUPPORTED_PLATFORMS.find(p => p.os === os && p.arch === arch) ?? null;
}

export function getArchiveExtension(os: string): 'tar.xz' | 'zip' {
  return os === 'win32' ? 'zip' : 'tar.xz';
}

export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

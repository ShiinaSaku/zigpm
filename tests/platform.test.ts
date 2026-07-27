import { expect, test, describe } from 'bun:test';
import {
  SUPPORTED_PLATFORMS,
  getPlatformPackageName,
  getArchiveExtension,
  formatBytes,
} from '../src/utils/platform';

describe('SUPPORTED_PLATFORMS', () => {
  test('has 8 platforms', () => {
    expect(SUPPORTED_PLATFORMS.length).toBe(8);
  });

  test('includes linux-x64', () => {
    const p = SUPPORTED_PLATFORMS.find(p => p.os === 'linux' && p.arch === 'x86_64');
    expect(p).toBeDefined();
    expect(p?.npmCpu).toEqual(['x64']);
  });

  test('includes darwin-arm64', () => {
    const p = SUPPORTED_PLATFORMS.find(p => p.os === 'darwin' && p.arch === 'aarch64');
    expect(p).toBeDefined();
    expect(p?.binaryName).toBe('zig');
  });

  test('includes win32-x64', () => {
    const p = SUPPORTED_PLATFORMS.find(p => p.os === 'win32' && p.arch === 'x86_64');
    expect(p).toBeDefined();
    expect(p?.binaryName).toBe('zig.exe');
  });

  test('includes riscv64', () => {
    const p = SUPPORTED_PLATFORMS.find(p => p.arch === 'riscv64');
    expect(p).toBeDefined();
    expect(p?.npmCpu).toEqual(['riscv64']);
  });

  test('includes loongarch64', () => {
    const p = SUPPORTED_PLATFORMS.find(p => p.arch === 'loongarch64');
    expect(p).toBeDefined();
    expect(p?.npmCpu).toEqual(['loong64']);
  });
});

describe('getPlatformPackageName', () => {
  test('generates correct package name for linux-x64', () => {
    const p = SUPPORTED_PLATFORMS.find(p => p.os === 'linux' && p.arch === 'x86_64')!;
    expect(getPlatformPackageName(p)).toBe('@zigpm/zig-linux-x64');
  });

  test('generates correct package name for darwin-arm64', () => {
    const p = SUPPORTED_PLATFORMS.find(p => p.os === 'darwin' && p.arch === 'aarch64')!;
    expect(getPlatformPackageName(p)).toBe('@zigpm/zig-darwin-arm64');
  });

  test('generates correct package name for win32-arm64', () => {
    const p = SUPPORTED_PLATFORMS.find(p => p.os === 'win32' && p.arch === 'aarch64')!;
    expect(getPlatformPackageName(p)).toBe('@zigpm/zig-win32-arm64');
  });
});

describe('getArchiveExtension', () => {
  test('returns tar.xz for linux', () => {
    expect(getArchiveExtension('linux')).toBe('tar.xz');
  });

  test('returns tar.xz for darwin', () => {
    expect(getArchiveExtension('darwin')).toBe('tar.xz');
  });

  test('returns zip for win32', () => {
    expect(getArchiveExtension('win32')).toBe('zip');
  });
});

describe('formatBytes', () => {
  test('formats bytes', () => {
    expect(formatBytes(0)).toBe('0.00 B');
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(1048576)).toBe('1.00 MB');
    expect(formatBytes(1073741824)).toBe('1.00 GB');
  });
});

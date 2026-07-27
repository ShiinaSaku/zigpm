import { expect, test, describe } from 'bun:test';
import { detectFormat } from '../src/extract/extract';

describe('detectFormat', () => {
  test('detects tar.xz', () => {
    expect(detectFormat('zig-linux-x86_64-0.15.2.tar.xz')).toBe('tar.xz');
  });

  test('detects tar.gz', () => {
    expect(detectFormat('zig-linux-x86_64-0.15.2.tar.gz')).toBe('tar.gz');
    expect(detectFormat('zig-linux-x86_64-0.15.2.tgz')).toBe('tar.gz');
  });

  test('detects zip', () => {
    expect(detectFormat('zig-windows-x86_64-0.15.2.zip')).toBe('zip');
  });

  test('throws for unknown format', () => {
    expect(() => detectFormat('file.unknown')).toThrow('Unknown archive format');
  });

  test('throws for no extension', () => {
    expect(() => detectFormat('file')).toThrow('Unknown archive format');
  });
});

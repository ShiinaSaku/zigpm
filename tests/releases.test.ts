import { expect, test, describe } from 'bun:test';
import { getLatestVersion, getStableVersion, getUnpublishedReleases, clearReleaseCache } from '../src/releases/releases';
import type { ZigRelease } from '../src/types';

const mockReleases: Record<string, ZigRelease> = {
  '0.15.2': {
    version: '0.15.2',
    date: '2024-10-01',
    docs: 'https://docs.ziglang.org/0.15.2',
    src: null,
    notes: null,
    published_at: null,
    platforms: {},
  },
  '0.16.0': {
    version: '0.16.0',
    date: '2024-12-01',
    docs: 'https://docs.ziglang.org/0.16.0',
    src: null,
    notes: null,
    published_at: null,
    platforms: {},
  },
  '0.17.0-beta.1': {
    version: '0.17.0-beta.1',
    date: '2025-01-15',
    docs: 'https://docs.ziglang.org/0.17.0-beta.1',
    src: null,
    notes: null,
    published_at: null,
    platforms: {},
  },
  '0.18.0-dev.1000': {
    version: '0.18.0-dev.1000',
    date: '2025-02-01',
    docs: 'https://docs.ziglang.org/0.18.0-dev.1000',
    src: null,
    notes: null,
    published_at: null,
    platforms: {},
  },
};

describe('getLatestVersion', () => {
  test('returns highest version', () => {
    const latest = getLatestVersion(mockReleases);
    // 0.18.0-dev.1000 has highest major.minor
    expect(latest).toBe('0.18.0-dev.1000');
  });

  test('returns empty string for empty releases', () => {
    expect(getLatestVersion({})).toBe('');
  });
});

describe('getStableVersion', () => {
  test('returns highest stable version', () => {
    const stable = getStableVersion(mockReleases);
    expect(stable).toBe('0.16.0');
  });

  test('returns null when no stable', () => {
    expect(getStableVersion({ '0.17.0-beta.1': mockReleases['0.17.0-beta.1'] })).toBeNull();
  });
});

describe('getUnpublishedReleases', () => {
  test('filters out published versions', () => {
    const unpublished = getUnpublishedReleases(mockReleases, ['0.15.2', '0.16.0']);
    expect(Object.keys(unpublished)).toEqual(['0.17.0-beta.1', '0.18.0-dev.1000']);
  });

  test('returns all when none published', () => {
    const unpublished = getUnpublishedReleases(mockReleases, []);
    expect(Object.keys(unpublished).length).toBe(4);
  });

  test('returns empty when all published', () => {
    const unpublished = getUnpublishedReleases(mockReleases, Object.keys(mockReleases));
    expect(Object.keys(unpublished).length).toBe(0);
  });
});

describe('clearReleaseCache', () => {
  test('clears without error', () => {
    expect(() => clearReleaseCache()).not.toThrow();
  });
});

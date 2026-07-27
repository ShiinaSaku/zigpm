import { expect, test, describe } from 'bun:test';
import { parseVersion, versionToNpm, compareVersions, isVersionPublished } from '../src/utils/version';

describe('parseVersion', () => {
  test('parses stable version', () => {
    const v = parseVersion('0.15.2');
    expect(v.channel).toBe('stable');
    expect(v.major).toBe(0);
    expect(v.minor).toBe(15);
    expect(v.patch).toBe(2);
    expect(v.semver).toBe('0.15.2');
  });

  test('parses version with v prefix', () => {
    const v = parseVersion('v0.16.0');
    expect(v.channel).toBe('stable');
    expect(v.semver).toBe('0.16.0');
  });

  test('parses beta version', () => {
    const v = parseVersion('0.17.0-beta.1');
    expect(v.channel).toBe('beta');
    expect(v.prerelease).toBe('beta.1');
  });

  test('parses rc version', () => {
    const v = parseVersion('0.18.0-rc.2');
    expect(v.channel).toBe('rc');
    expect(v.prerelease).toBe('rc.2');
  });

  test('parses dev version', () => {
    const v = parseVersion('0.18.0-dev.1234');
    expect(v.channel).toBe('dev');
    expect(v.prerelease).toBe('dev.1234');
  });

  test('preserves original raw version', () => {
    const v = parseVersion('0.15.2');
    expect(v.raw).toBe('0.15.2');
  });
});

describe('versionToNpm', () => {
  test('stable version passes through', () => {
    expect(versionToNpm('0.15.2')).toBe('0.15.2');
  });

  test('beta version passes through (valid semver)', () => {
    expect(versionToNpm('0.17.0-beta.1')).toBe('0.17.0-beta.1');
  });

  test('dev version passes through', () => {
    expect(versionToNpm('0.18.0-dev.1234')).toBe('0.18.0-dev.1234');
  });
});

describe('compareVersions', () => {
  test('compares stable versions correctly', () => {
    expect(compareVersions('0.15.2', '0.16.0')).toBeLessThan(0);
    expect(compareVersions('0.16.0', '0.15.2')).toBeGreaterThan(0);
  });

  test('equal versions return 0', () => {
    expect(compareVersions('0.15.2', '0.15.2')).toBe(0);
  });

  test('stable ranks higher than beta', () => {
    expect(compareVersions('0.17.0', '0.17.0-beta.1')).toBeLessThan(0);
  });

  test('beta ranks higher than dev', () => {
    expect(compareVersions('0.18.0-beta.1', '0.18.0-dev.1234')).toBeLessThan(0);
  });
});

describe('isVersionPublished', () => {
  test('returns true if version is in list', () => {
    expect(isVersionPublished('0.15.2', ['0.15.2', '0.16.0'])).toBe(true);
  });

  test('returns false if version is not in list', () => {
    expect(isVersionPublished('0.17.0', ['0.15.2', '0.16.0'])).toBe(false);
  });

  test('returns false for empty list', () => {
    expect(isVersionPublished('0.15.2', [])).toBe(false);
  });
});

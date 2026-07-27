import type { ZigVersion } from "../types";

export function parseVersion(raw: string): ZigVersion {
  const cleaned = raw.startsWith("v") ? raw.slice(1) : raw;

  const stableMatch = cleaned.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (stableMatch) {
    return {
      raw,
      semver: cleaned,
      channel: "stable",
      major: parseInt(stableMatch[1], 10),
      minor: parseInt(stableMatch[2], 10),
      patch: parseInt(stableMatch[3], 10),
    };
  }

  const betaMatch = cleaned.match(/^(\d+)\.(\d+)\.(\d+)-beta\.(\d+)$/);
  if (betaMatch) {
    return {
      raw,
      semver: cleaned,
      channel: "beta",
      major: parseInt(betaMatch[1], 10),
      minor: parseInt(betaMatch[2], 10),
      patch: parseInt(betaMatch[3], 10),
      prerelease: `beta.${betaMatch[4]}`,
    };
  }

  const rcMatch = cleaned.match(/^(\d+)\.(\d+)\.(\d+)-rc\.(\d+)$/);
  if (rcMatch) {
    return {
      raw,
      semver: cleaned,
      channel: "rc",
      major: parseInt(rcMatch[1], 10),
      minor: parseInt(rcMatch[2], 10),
      patch: parseInt(rcMatch[3], 10),
      prerelease: `rc.${rcMatch[4]}`,
    };
  }

  const devMatch = cleaned.match(/^(\d+)\.(\d+)\.(\d+)-dev\.(\d+)(?:\+(.+))?$/);
  if (devMatch) {
    return {
      raw,
      semver: replaceDevPlus(cleaned),
      channel: "dev",
      major: parseInt(devMatch[1], 10),
      minor: parseInt(devMatch[2], 10),
      patch: parseInt(devMatch[3], 10),
      prerelease: `dev.${devMatch[4]}`,
      build: devMatch[2],
    };
  }

  const fallback: ZigVersion = {
    raw,
    semver: cleaned,
    channel: "dev",
    major: 0,
    minor: 0,
    patch: 0,
    prerelease: cleaned,
  };

  return fallback;
}

function replaceDevPlus(version: string): string {
  return version.replace(/\+/, "-");
}

export function versionToNpm(version: string): string {
  const parsed = parseVersion(version);
  return parsed.semver;
}

export function isVersionPublished(version: string, packages: string[]): boolean {
  return packages.includes(version);
}

export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);

  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  if (pa.patch !== pb.patch) return pa.patch - pb.patch;

  const order = ["stable", "rc", "beta", "dev"] as const;
  const oa = order.indexOf(pa.channel);
  const ob = order.indexOf(pb.channel);
  if (oa !== ob) return oa - ob;

  if (pa.prerelease && pb.prerelease) {
    const na = parseInt(pa.prerelease.split(".")[1] ?? "0", 10);
    const nb = parseInt(pb.prerelease.split(".")[1] ?? "0", 10);
    return na - nb;
  }

  return 0;
}

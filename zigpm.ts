#!/usr/bin/env bun
import { chmodSync, existsSync, mkdirSync, renameSync, rmSync } from "fs";
import { basename, dirname, join } from "path";

const DRY_RUN = process.argv.includes("--dry-run");

const INDEX_URL = process.env.INDEX_URL || "https://ziglang.org/download/index.json";
const ZIG_VERSION = process.env.ZIG_VERSION || "latest";
const ONLY_PLATFORM = process.env.ZIG_PLATFORM || "";

const REPOSITORY = process.env.GITHUB_REPOSITORY || "ShiinaSaku/zigpm";
const REPOSITORY_URL = `git+https://github.com/${REPOSITORY}.git`;

const OS_TO_NPM: Record<string, string> = {
  macos: "darwin",
  linux: "linux",
  windows: "win32",
};

const ARCH_TO_NPM: Record<string, string> = {
  x86_64: "x64",
  aarch64: "arm64",
  riscv64: "riscv64",
  loongarch64: "loong64",
  x86: "x86",
  i386: "x86",
  arm: "arm",
  armv7a: "arm",
  armv6kz: "arm",
};

const SUPPORTED_PLATFORMS = new Set([
  "linux-x64",
  "linux-arm64",
  "linux-riscv64",
  "linux-loong64",
  "darwin-x64",
  "darwin-arm64",
  "win32-x64",
  "win32-arm64",
]);

const NPM_OS: Record<string, string[]> = {
  "linux-arm64": ["linux", "android"],
};

const META_KEYS = new Set([
  "version",
  "date",
  "docs",
  "stdDocs",
  "src",
  "bootstrap",
  "notes",
  "published_at",
  "raw",
]);

const ROOT_PACKAGE = "@zigpm/zig";

const INSTALL_JS = `#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

export function extractArchive(archivePath, destDir, binary) {
  rmSync(destDir, { recursive: true, force: true });
  mkdirSync(destDir, { recursive: true });
  const proc = spawnSync("tar", ["-xf", archivePath, "-C", destDir], { stdio: "inherit" });
  if (proc.status !== 0) {
    throw new Error("zigpm: failed to extract " + archivePath + " (tar is required)");
  }
  const entries = readdirSync(destDir);
  const top = entries.length === 1 ? join(destDir, entries[0]) : destDir;
  for (const entry of readdirSync(top)) {
    renameSync(join(top, entry), join(destDir, entry));
  }
  if (top !== destDir) rmSync(top, { recursive: true, force: true });
  if (process.platform !== "win32") chmodSync(join(destDir, binary), 0o755);
}

function main() {
  const binary = process.platform === "win32" ? "zig.exe" : "zig";
  const zigDir = join(root, "zig");
  if (existsSync(join(zigDir, binary))) {
    process.exit(0);
  }

  const archive = existsSync(join(root, "zig.zip")) ? "zig.zip" : "zig.tar.xz";
  if (!existsSync(join(root, archive))) {
    console.error("zigpm: missing " + archive + ", reinstall the package to restore it");
    process.exit(1);
  }

  try {
    extractArchive(join(root, archive), zigDir, binary);
  } catch (error) {
    console.error(String(error));
    process.exit(1);
  }
  rmSync(join(root, archive), { force: true });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
`;

const LAUNCHER_JS = `#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractArchive } from "../install.mjs";

const binDir = dirname(fileURLToPath(import.meta.url));
const root = dirname(binDir);
const binary = process.platform === "win32" ? "zig.exe" : "zig";

let target = join(root, "zig", binary);
if (!existsSync(target)) {
  const cacheDir = join(homedir(), ".cache", "zigpm", process.platform + "-" + process.arch);
  target = join(cacheDir, binary);
  if (!existsSync(target)) {
    const archive = existsSync(join(root, "zig.zip")) ? "zig.zip" : "zig.tar.xz";
    if (!existsSync(join(root, archive))) {
      console.error("zigpm: missing " + archive + ", reinstall the package to restore it");
      process.exit(1);
    }
    try {
      extractArchive(join(root, archive), cacheDir, binary);
    } catch (error) {
      console.error(String(error));
      process.exit(1);
    }
  }
}

const proc = spawnSync(target, process.argv.slice(2), { stdio: "inherit" });
process.exit(proc.status === null ? 1 : proc.status);
`;

const ZIG_WRAPPER = `#!/usr/bin/env bash
root="$(dirname "$(dirname "$(readlink -f "$0")")")"
platform_pkg="@zigpm/zig-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/x64/; s/aarch64/arm64/')"
platform_dir="$root/node_modules/$platform_pkg"
if [ ! -d "$platform_dir" ]; then
  platform_dir="$root/../$platform_pkg"
fi
if [ -f "$platform_dir/bin/zig.mjs" ]; then
  exec "$platform_dir/bin/zig.mjs" "$@"
elif [ -f "$platform_dir/bin/zig" ]; then
  exec "$platform_dir/bin/zig" "$@"
elif [ -f "$platform_dir/bin/zig.exe" ]; then
  exec "$platform_dir/bin/zig.exe" "$@"
else
  echo "Error: Zig binary not found for your platform ($(uname -s)-$(uname -m))" >&2
  exit 1
fi
`;

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  channel: "stable" | "rc" | "beta" | "dev";
  prerelease: number;
}

function parseVersion(raw: string): ParsedVersion {
  const cleaned = raw.startsWith("v") ? raw.slice(1) : raw;
  const m = cleaned.match(/^(\d+)\.(\d+)\.(\d+)(?:-(beta|rc|dev)\.(\d+))?(?:\+.*)?$/);
  if (!m) return { major: 0, minor: 0, patch: 0, channel: "dev", prerelease: 0 };
  return {
    major: parseInt(m[1], 10),
    minor: parseInt(m[2], 10),
    patch: parseInt(m[3], 10),
    channel: (m[4] as ParsedVersion["channel"]) ?? "stable",
    prerelease: m[5] ? parseInt(m[5], 10) : 0,
  };
}

function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);

  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  if (pa.patch !== pb.patch) return pa.patch - pb.patch;

  const order = ["stable", "rc", "beta", "dev"] as const;
  const oa = order.indexOf(pa.channel);
  const ob = order.indexOf(pb.channel);
  if (oa !== ob) return oa - ob;
  return pa.prerelease - pb.prerelease;
}

function npmVersion(version: string): string {
  return version.replace(/^v/, "").replace(/\+\S+$/, "");
}

function getLatestVersion(sources: Record<string, unknown>): string {
  const versions = Object.keys(sources).sort(compareVersions);
  return versions[versions.length - 1];
}

class Download {
  packageName: string = "";

  constructor(
    public readonly url: string,
    public readonly arch: string,
    public readonly os: string,
    public readonly version: string,
    public blob: Blob,
  ) {}

  get fileName() {
    return basename(this.url);
  }

  get folder() {
    return join(process.cwd(), this.fileName).replace(
      /\.(tar\.gz|tgz|gz|zip|tar\.xz|txz|xz)$/i,
      "",
    );
  }

  async download() {
    if (existsSync(this.folder)) rmSync(this.folder, { recursive: true, force: true });

    await Bun.write(this.fileName, this.blob);
    // @ts-expect-error release the blob once written to disk
    this.blob = undefined;

    const name = this.fileName;
    const args = name.endsWith(".zip") ? ["unzip", "-t", name] : ["tar", "-tf", name];
    const proc = Bun.spawnSync(args, { stderr: "pipe", stdout: "ignore" });
    if (proc.exitCode !== 0) {
      throw new Error(`invalid archive ${name}: ${proc.stderr.toString() || "unknown error"}`);
    }
  }

  async generatePackage() {
    const npmOs = OS_TO_NPM[this.os];
    const npmCpu = ARCH_TO_NPM[this.arch];
    this.packageName = `@zigpm/zig-${npmOs}-${npmCpu}`;

    const archive = this.os === "windows" ? "zig.zip" : "zig.tar.xz";
    mkdirSync(this.folder, { recursive: true });
    renameSync(this.fileName, join(this.folder, archive));

    const packageJson = {
      name: this.packageName,
      version: this.version,
      description: `Zig compiler for ${this.os}-${this.arch}`,
      os: NPM_OS[`${npmOs}-${npmCpu}`] ?? [npmOs],
      cpu: [npmCpu],
      license: "MIT",
      repository: { type: "git", url: REPOSITORY_URL },
      bin: { zig: "bin/zig.mjs" },
      scripts: { postinstall: "node install.mjs" },
      preferUnplugged: true,
    };

    await Bun.write(join(this.folder, "package.json"), JSON.stringify(packageJson, null, 2));
    await Bun.write(join(this.folder, "install.mjs"), INSTALL_JS);
    const launcher = join(this.folder, "bin", "zig.mjs");
    mkdirSync(dirname(launcher), { recursive: true });
    await Bun.write(launcher, LAUNCHER_JS);
    chmodSync(launcher, 0o755);

    rmSync(this.packageName, { recursive: true, force: true });
    mkdirSync(dirname(this.packageName), { recursive: true });
    console.log(`Packaged ${this.packageName}`);
    renameSync(this.folder, this.packageName);
  }
}

async function isPublished(name: string, version: string): Promise<boolean> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${name}/${version}`);
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  const response = await fetch(INDEX_URL);
  if (!response.ok) {
    throw new Error(`failed to fetch ${INDEX_URL}: ${response.status} ${response.statusText}`);
  }

  const sources: Record<string, any> = await response.json();

  const selectedVersion = ZIG_VERSION === "latest" ? getLatestVersion(sources) : ZIG_VERSION;
  const release = sources[selectedVersion];
  if (!release) {
    throw new Error(`zig version "${ZIG_VERSION}" not found in ${INDEX_URL}`);
  }

  const version = npmVersion(release.version ?? selectedVersion);
  console.log(`Packaging @zigpm/zig@${version}${DRY_RUN ? " [DRY RUN]" : ""}`);

  const tasks: Promise<Download | null>[] = [];

  for (const key of Object.keys(release)) {
    if (META_KEYS.has(key)) continue;

    const [arch, os] = key.split("-");
    const npmOs = OS_TO_NPM[os];
    const npmCpu = ARCH_TO_NPM[arch];
    const platform = `${npmOs}-${npmCpu}`;

    if (!npmOs || !npmCpu || !SUPPORTED_PLATFORMS.has(platform)) continue;
    if (ONLY_PLATFORM && platform !== ONLY_PLATFORM) continue;

    const { tarball, shasum } = release[key];
    if (!tarball || !shasum) {
      console.warn(`missing tarball or shasum for ${key}`);
      continue;
    }

    tasks.push(
      fetch(tarball)
        .then((r) => {
          if (!r.ok) throw new Error(`failed to fetch ${tarball}: ${r.status}`);
          return r.blob();
        })
        .then((blob) => new Download(tarball, arch, os, version, blob))
        .then((download) =>
          download
            .download()
            .then(() => download.generatePackage())
            .then(() => download),
        )
        .catch((error) => {
          console.error(`Failed ${platform}: ${error instanceof Error ? error.message : error}`);
          return null;
        }),
    );
  }

  const all = (await Promise.all(tasks)).filter((d): d is Download => d !== null);

  if (all.length === 0) {
    throw new Error("no platform packages were generated");
  }

  const rootPackage = {
    name: ROOT_PACKAGE,
    version,
    description: "Zig compiler for all platforms",
    license: "MIT",
    repository: { type: "git", url: REPOSITORY_URL },
    optionalDependencies: Object.fromEntries(all.map((d) => [d.packageName, version])),
    bin: { zig: "zig" },
    preferUnplugged: true,
  };

  rmSync(ROOT_PACKAGE, { recursive: true, force: true });
  mkdirSync(ROOT_PACKAGE, { recursive: true });

  await Bun.write(`${ROOT_PACKAGE}/zig`, ZIG_WRAPPER);
  chmodSync(`${ROOT_PACKAGE}/zig`, 0o777);
  await Bun.write(`${ROOT_PACKAGE}/package.json`, JSON.stringify(rootPackage, null, 2));

  const targets = [...all.map((d) => d.packageName), ROOT_PACKAGE];

  for (const dir of targets) {
    if (!existsSync(dir)) {
      throw new Error(`missing ${dir}`);
    }

    if (await isPublished(dir, version)) {
      console.log(`Already published ${dir}@${version}`);
      continue;
    }

    console.log(`Publishing ${dir}@${version}`);
    const proc = Bun.spawnSync({
      cmd: ["npm", "publish", "--access", "public", DRY_RUN ? "--dry-run" : ""].filter(Boolean),
      cwd: dir,
      stderr: "inherit",
      stdin: "inherit",
      stdout: "inherit",
    });
    if (proc.exitCode !== 0) {
      throw new Error(`npm publish failed for ${dir}@${version} (exit ${proc.exitCode})`);
    }
  }
}

await main();

export {};

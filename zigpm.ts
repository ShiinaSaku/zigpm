#!/usr/bin/env bun
import { chmodSync, existsSync, mkdirSync, renameSync, rmSync } from "fs";
import { basename, dirname, join } from "path";

const DRY_RUN = process.argv.includes("--dry-run");

const INDEX_URL = process.env.INDEX_URL || "https://ziglang.org/download/index.json";
const ZIG_VERSION = process.env.ZIG_VERSION || "latest";
const ONLY_PLATFORM = process.env.ZIG_PLATFORM || "";

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

const ZIG_WRAPPER = `#!/usr/bin/env bash
root="$(dirname "$(dirname "$(readlink -f "$0")")")"
platform_pkg="@zigpm/zig-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/x64/; s/aarch64/arm64/')"
platform_dir="$root/node_modules/$platform_pkg"
if [ ! -d "$platform_dir" ]; then
  platform_dir="$root/../$platform_pkg"
fi
if [ -f "$platform_dir/bin/zig" ]; then
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

  async extract() {
    if (existsSync(this.folder)) rmSync(this.folder, { recursive: true, force: true });

    await Bun.write(this.fileName, this.blob);
    // @ts-expect-error release the blob once written to disk
    this.blob = undefined;

    const name = this.fileName;
    const args = name.endsWith(".zip")
      ? ["unzip", "-o", name]
      : ["tar", name.endsWith(".gz") ? "-xzf" : "-xJf", name];
    const proc = Bun.spawnSync(args, { stderr: "pipe", stdout: "ignore" });
    if (proc.exitCode !== 0) {
      throw new Error(`failed to extract ${name}: ${proc.stderr.toString() || "unknown error"}`);
    }

    rmSync(this.fileName, { force: true });
  }

  async generatePackage() {
    const npmOs = OS_TO_NPM[this.os];
    const npmCpu = ARCH_TO_NPM[this.arch];
    const binary = this.os === "windows" ? "zig.exe" : "zig";
    this.packageName = `@zigpm/zig-${npmOs}-${npmCpu}`;

    const packageJson = {
      name: this.packageName,
      version: this.version,
      description: `Zig compiler for ${this.os}-${this.arch}`,
      os: NPM_OS[`${npmOs}-${npmCpu}`] ?? [npmOs],
      cpu: [npmCpu],
      license: "MIT",
      bin: { zig: `bin/${binary}` },
      preferUnplugged: true,
    };

    await Bun.write(join(this.folder, "package.json"), JSON.stringify(packageJson, null, 2));
    console.log(`Saved ${this.folder}/package.json`);

    const sourceBinary = join(this.folder, binary);
    if (!existsSync(sourceBinary)) {
      throw new Error(`binary not found: ${sourceBinary}`);
    }

    const binDir = join(this.folder, "bin");
    mkdirSync(binDir, { recursive: true });
    renameSync(sourceBinary, join(binDir, binary));
    chmodSync(join(binDir, binary), 0o755);

    rmSync(this.packageName, { recursive: true, force: true });
    mkdirSync(dirname(this.packageName), { recursive: true });

    console.log(`Renaming ${this.folder} to ${this.packageName}`);
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
            .extract()
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
    optionalDependencies: Object.fromEntries(all.map((d) => [d.packageName, version])),
    repository: "https://github.com/zigpm/zig",
    bin: { zig: "zig" },
    preferUnplugged: true,
  };

  rmSync(ROOT_PACKAGE, { recursive: true, force: true });
  mkdirSync(ROOT_PACKAGE, { recursive: true });

  await Bun.write(`${ROOT_PACKAGE}/zig`, ZIG_WRAPPER);
  chmodSync(`${ROOT_PACKAGE}/zig`, 0o777);
  await Bun.write(`${ROOT_PACKAGE}/package.json`, JSON.stringify(rootPackage, null, 2));

  for (const downloaded of all) {
    if (!existsSync(downloaded.packageName)) {
      throw new Error(`missing ${downloaded.packageName}`);
    }
  }

  const targets = [...all.map((d) => d.packageName), ROOT_PACKAGE];

  for (const dir of targets) {
    if (await isPublished(dir, version)) {
      console.log(`Already published ${dir}@${version}`);
      continue;
    }

    const { exited } = Bun.spawn({
      cmd: ["npm", "publish", "--access", "public", DRY_RUN ? "--dry-run" : ""].filter(Boolean),
      cwd: dir,
      stderr: "inherit",
      stdin: "inherit",
      stdout: "inherit",
    });
    await exited;
  }
}

await main();

export {};

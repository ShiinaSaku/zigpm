import { readFile, writeFile, copyFile, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename } from 'path';
import { logger } from '../utils/logger';
import { getPlatformPackageName, SUPPORTED_PLATFORMS } from '../utils/platform';
import { ensureDir } from '../utils/file';
import type { PlatformTriple } from '../types';

const ROOT_PACKAGE_NAME = '@zigpm/zig';

export async function generatePlatformPackage(
  version: string,
  platform: PlatformTriple,
  extractDir: string,
): Promise<void> {
  const pkgName = getPlatformPackageName(platform);
  const pkgDir = `packages/${pkgName}`;
  ensureDir(pkgDir);

  const binDir = join(pkgDir, 'bin');
  ensureDir(binDir);

  const zigBinary = await findBinary(extractDir, platform.binaryName);
  if (!zigBinary) {
    throw new Error(`Zig binary not found in ${extractDir} for ${platform.suffix}`);
  }

  const destBinary = join(binDir, platform.binaryName);
  await copyFile(zigBinary, destBinary);
  await makeExecutable(destBinary);

  const packageJson = {
    name: pkgName,
    version,
    description: `Zig compiler for ${platform.os}-${platform.arch}`,
    os: platform.npmOs,
    cpu: platform.npmCpu,
    license: 'MIT',
    bin: {
      zig: `bin/${platform.binaryName}`,
    },
    preferUnplugged: true,
  };

  await writeFile(
    join(pkgDir, 'package.json'),
    JSON.stringify(packageJson, null, 2) + '\n',
  );

  const license = await readLicense(extractDir);
  await writeFile(join(pkgDir, 'LICENSE'), license);

  const readme = generatePlatformReadme(pkgName, version, platform);
  await writeFile(join(pkgDir, 'README.md'), readme);

  logger.info(`Generated ${pkgName}@${version}`);
}

export async function generateRootPackage(version: string): Promise<void> {
  const rootDir = 'packages/root';
  ensureDir(rootDir);

  const optionalDeps: Record<string, string> = {};
  for (const platform of SUPPORTED_PLATFORMS) {
    const pkgName = getPlatformPackageName(platform);
    optionalDeps[pkgName] = version;
  }

  const packageJson = {
    name: ROOT_PACKAGE_NAME,
    version,
    description: 'Modern Zig distribution for npm — install the Zig compiler with a single command',
    keywords: ['zig', 'ziglang', 'compiler', 'zigpm'],
    license: 'MIT',
    homepage: 'https://github.com/zigpm/zig',
    repository: {
      type: 'git',
      url: 'git+https://github.com/zigpm/zig.git',
    },
    bin: {
      zig: 'zig',
    },
    optionalDependencies: optionalDeps,
    engines: {
      node: '>=18',
    },
    preferUnplugged: true,
  };

  await writeFile(
    join(rootDir, 'package.json'),
    JSON.stringify(packageJson, null, 2) + '\n',
  );

  await writeFile(join(rootDir, 'LICENSE'), await readDefaultLicense());

  const wrapperScript = `#!/usr/bin/env bash
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
  echo "Ensure @zigpm/zig-* platform package is installed." >&2
  exit 1
fi
`;

  await writeFile(join(rootDir, 'zig'), wrapperScript);
  await makeExecutable(join(rootDir, 'zig'));

  const readme = generateRootReadme(version);
  await writeFile(join(rootDir, 'README.md'), readme);

  logger.info(`Generated ${ROOT_PACKAGE_NAME}@${version}`);
}

async function findBinary(dir: string, binaryName: string): Promise<string | null> {
  const candidates = [
    join(dir, binaryName),
    join(dir, 'zig', binaryName),
    join(dir, 'bin', binaryName),
    join(dir, 'zig', 'bin', binaryName),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  try {
    const entries = await readdir(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const st = await stat(fullPath).catch(() => null);
      if (!st) continue;
      if (!st.isDirectory()) {
        if (basename(fullPath) === binaryName) {
          return fullPath;
        }
      } else {
        const result = await findBinary(fullPath, binaryName);
        if (result) return result;
      }
    }
  } catch {}

  return null;
}

async function makeExecutable(filePath: string): Promise<void> {
  await Bun.spawnSync(['chmod', '+x', filePath]);
}

async function readLicense(extractDir: string): Promise<string> {
  const candidates = [
    join(extractDir, 'LICENSE'),
    join(extractDir, 'zig', 'LICENSE'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return await readFile(candidate, 'utf-8');
    }
  }
  return await readDefaultLicense();
}

async function readDefaultLicense(): Promise<string> {
  return `MIT License

Copyright (c) 2026 zigpm

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;
}

function generatePlatformReadme(pkgName: string, version: string, platform: PlatformTriple): string {
  return `# ${pkgName}

Zig compiler for ${platform.os}-${platform.arch}.

Part of the [@zigpm/zig](https://github.com/zigpm/zig) distribution.

## Install

\`\`\`bash
npm install ${pkgName}
\`\`\`

## Version

${version}

## Platform

- OS: ${platform.npmOs.join(', ')}
- CPU: ${platform.npmCpu.join(', ')}

## License

MIT
`;
}

function generateRootReadme(version: string): string {
  return `# @zigpm/zig

Modern Zig distribution for npm.

## Install

\`\`\`bash
npm install -g @zigpm/zig
\`\`\`

## Usage

\`\`\`bash
zig version
\`\`\`

## Version

${version}

## License

MIT
`;
}

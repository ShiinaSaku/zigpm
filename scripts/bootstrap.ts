#!/usr/bin/env bun
import { execSync } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const PLATFORM_PACKAGES = [
  "@zigpm/zig-linux-x64",
  "@zigpm/zig-linux-arm64",
  "@zigpm/zig-linux-riscv64",
  "@zigpm/zig-linux-loong64",
  "@zigpm/zig-darwin-x64",
  "@zigpm/zig-darwin-arm64",
  "@zigpm/zig-win32-x64",
  "@zigpm/zig-win32-arm64",
];

const ROOT_PACKAGE = "@zigpm/zig";
const PLACEHOLDER_VERSION = "0.0.0";

async function main() {
  const tmpDir = join("/tmp", `zigpm-bootstrap-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  const packages = [...PLATFORM_PACKAGES, ROOT_PACKAGE];

  for (const name of packages) {
    const pkgDir = join(tmpDir, name);
    mkdirSync(pkgDir, { recursive: true });

    const packageJson = {
      name,
      version: PLACEHOLDER_VERSION,
      description: `Placeholder for ${name} — real versions published by CI`,
      license: "MIT",
    };

    writeFileSync(
      join(pkgDir, "package.json"),
      JSON.stringify(packageJson, null, 2) + "\n",
    );

    console.log(`Publishing ${name}@${PLACEHOLDER_VERSION}...`);
    execSync("npm publish --access public", {
      cwd: pkgDir,
      stdio: "inherit",
    });
    console.log(`Published ${name}@${PLACEHOLDER_VERSION}`);
  }

  console.log("\nAll placeholder packages published!");
  console.log("Now configure trusted publishing on npm for each package:");
  for (const name of packages) {
    console.log(`  https://www.npmjs.com/settings/${name.split("/")[0].slice(1)}/packages/${name.split("/")[1]}/trusted-publishing`);
  }
}

main().catch((err) => {
  console.error("Bootstrap failed:", err);
  process.exit(1);
});

# @zigpm/zig — Modern Zig Distribution for npm

The definitive, community-maintained npm distribution of the [Zig](https://ziglang.org) compiler.

```bash
npm install -g @zigpm/zig
```

## Features

- **All official releases** — Stable, Beta, Release Candidate, and Development snapshots
- **All platforms** — linux-x64, linux-arm64, linux-riscv64, linux-loong64, darwin-x64, darwin-arm64, win32-x64, win32-arm64
- **Zero setup** — Just `npm install`
- **Verified binaries** — Every archive is verified with minisign signatures and SHA256 checksums
- **Automatic updates** — GitHub Actions publishes new releases automatically

## Usage

```bash
# Install globally
npm install -g @zigpm/zig

# Run zig
zig version
zig build-exe hello.zig

# Or use npx
npx @zigpm/zig version
```

## How It Works

The root `@zigpm/zig` package uses npm `optionalDependencies` to install only the platform-specific package for the user's system.

Each platform package contains:
- The `zig` (or `zig.exe`) binary
- `package.json` with os/cpu restrictions
- License file

## Development

```bash
# Install dependencies
bun install

# Sync latest releases
bun run sync

# Generate packages locally
bun run generate

# Run tests
bun test

# Type check
bun run typecheck
```

## License

MIT — see [LICENSE](LICENSE).

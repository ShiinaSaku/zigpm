# @zigpm/zig

Modern Zig distribution for npm — automatically packages every official
[Zig](https://ziglang.org) release.

```bash
npm install -g @zigpm/zig
zig version
```

## How it works

`zigpm.ts` is the whole project. It:

1. Fetches the official release index (`https://ziglang.org/download/index.json`)
2. Downloads every platform archive (linux/darwin/win32 × x64/arm64/riscv64/loong64)
3. Extracts, verifies, and builds `@zigpm/zig-<os>-<cpu>` platform packages
4. Builds the root `@zigpm/zig` package with a platform-detecting `zig` wrapper
5. Publishes everything to npm

The root package uses npm `optionalDependencies` so only your platform's
binary is installed. The `linux-arm64` package also declares `os: ["android"]`
so it works on ARM64 Android (e.g. Termux).

## Usage

```bash
# Publish the latest release (set ZIG_VERSION to pin one)
bun zigpm.ts

# Publish a specific version / channel
ZIG_VERSION=0.16.0 bun zigpm.ts

# Dry run — do everything but `npm publish --dry-run`
bun zigpm.ts --dry-run

# Only build one platform (useful for CI / testing)
ZIG_VERSION=0.15.2 ZIG_PLATFORM=linux-x64 bun zigpm.ts --dry-run
```

Environment:

| Var            | Default     | Purpose                         |
| -------------- | ----------- | ------------------------------- |
| `ZIG_VERSION`  | `latest`    | Release to package, or `latest` |
| `ZIG_PLATFORM` | all         | Build only one `os-cpu` pair    |
| `INDEX_URL`    | ziglang.org | Release index URL               |

Requires `tar` (xz) and `unzip` on the machine.

## License

MIT

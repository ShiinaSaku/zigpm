import { expect, test, describe } from "bun:test";
import { verifyArchive } from "../src/verify/verify";
import { writeFile, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

const testDir = "/tmp/zigpm-test-verify";

async function ensureTestDir() {
  if (!existsSync(testDir)) {
    await mkdir(testDir, { recursive: true });
  }
}

describe("verifyArchive", () => {
  test("returns error for missing archive", async () => {
    const result = await verifyArchive({
      archivePath: "/nonexistent/archive.tar.xz",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("not found");
  });

  test("detects filename mismatch", async () => {
    await ensureTestDir();
    const testFile = join(testDir, "wrong-name.txt");
    await writeFile(testFile, "test content");

    const result = await verifyArchive({
      archivePath: testFile,
      expectedFilename: "expected-name.txt",
    });
    expect(result.filenameMatch).toBe(false);

    await unlink(testFile);
  });

  test("detects SHA256 mismatch", async () => {
    await ensureTestDir();
    const testFile = join(testDir, "test.txt");
    await writeFile(testFile, "test content");

    const result = await verifyArchive({
      archivePath: testFile,
      expectedShasum: "0000000000000000000000000000000000000000000000000000000000000000",
    });
    expect(result.sha256Match).toBe(false);

    await unlink(testFile);
  });
});

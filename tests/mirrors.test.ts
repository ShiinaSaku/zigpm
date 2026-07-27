import { expect, test, describe } from "bun:test";
import { shuffleMirrors, clearMirrorCache } from "../src/download/mirrors";

describe("shuffleMirrors", () => {
  test("returns same length", () => {
    const mirrors = [
      { url: "https://mirror1.example.com" },
      { url: "https://mirror2.example.com" },
    ];
    const shuffled = shuffleMirrors(mirrors);
    expect(shuffled.length).toBe(2);
  });

  test("contains all original mirrors", () => {
    const mirrors = [
      { url: "https://mirror1.example.com" },
      { url: "https://mirror2.example.com" },
      { url: "https://mirror3.example.com" },
    ];
    const shuffled = shuffleMirrors(mirrors);
    for (const m of mirrors) {
      expect(shuffled.some((s) => s.url === m.url)).toBe(true);
    }
  });

  test("does not mutate original array", () => {
    const mirrors = [
      { url: "https://mirror1.example.com" },
      { url: "https://mirror2.example.com" },
    ];
    const original = [...mirrors];
    shuffleMirrors(mirrors);
    expect(mirrors).toEqual(original);
  });

  test("handles empty array", () => {
    expect(shuffleMirrors([])).toEqual([]);
  });

  test("handles single mirror", () => {
    const mirrors = [{ url: "https://mirror1.example.com" }];
    expect(shuffleMirrors(mirrors)).toEqual(mirrors);
  });
});

describe("clearMirrorCache", () => {
  test("clears without error", () => {
    expect(() => clearMirrorCache()).not.toThrow();
  });
});

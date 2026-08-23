import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("package metadata", () => {
  test("bin points at the compiled CLI path", async () => {
    const packageJson = JSON.parse(await readFile(path.resolve("package.json"), "utf8")) as { bin: { sf: string } };
    expect(packageJson.bin.sf).toBe("./dist/cli.js");
    expect(existsSync(path.resolve("src/cli.ts"))).toBe(true);
  });
});

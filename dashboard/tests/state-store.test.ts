import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { StateStore } from "../server/state-store.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

describe("StateStore", () => {
  it("persists checksum-indexed review state atomically", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "sf-dashboard-state-"));
    roots.push(root);
    const path = resolve(root, "state.json");
    const store = new StateStore(path);
    await store.update((state) => {
      state.videos.abc = { humanStatus: "approved", promoted: true, caption: "Ready", hashtags: ["science"], updatedAt: "2026-09-03T00:00:00.000Z" };
    });
    const persisted = JSON.parse(await readFile(path, "utf8")) as { videos: Record<string, unknown> };
    expect(persisted.videos.abc).toBeTruthy();
    expect((await new StateStore(path).read()).videos.abc?.humanStatus).toBe("approved");
  });
});

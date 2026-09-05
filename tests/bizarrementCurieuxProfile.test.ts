import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {describe, expect, it} from "vitest";

const root = resolve("production-profiles/bizarrement-curieux");
const v1 = resolve(root, "v1");
const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));

describe("bizarrement-curieux-v1 production profile", () => {
  it("keeps the approved technical and provider contract frozen", () => {
    const profile = readJson(resolve(v1, "profile.json"));
    const renderer = readJson(resolve(v1, "renderer/package.json"));

    expect(profile.status).toBe("frozen-human-approved");
    expect(profile.video).toMatchObject({width: 1080, height: 1920, fps: 30, durationFrames: 900});
    expect(profile.providers.baseEdit).toEqual({name: "MoneyPrinterTurbo", version: "1.3.5"});
    expect(profile.providers.dressing).toEqual({name: "Remotion", version: "4.0.518"});
    expect(renderer.dependencies.remotion).toBe("4.0.518");
    expect(renderer.dependencies["@remotion/cli"]).toBe("4.0.518");
  });

  it.each(["fr-FR", "en-US"])("has complete aligned %s manifests", (locale) => {
    const localeRoot = resolve(v1, "locales", locale);
    const episodes = readJson(resolve(localeRoot, "episodes.json"));
    const editorial = readJson(resolve(localeRoot, "editorial.json"));
    const shots = readJson(resolve(localeRoot, "shot-plan.json"));
    const visualQa = readJson(resolve(localeRoot, "visual-qa.json"));
    const ids = episodes.map(({id}: {id: string}) => id).sort();

    expect(episodes).toHaveLength(5);
    expect(editorial.map(({id}: {id: string}) => id).sort()).toEqual(ids);
    expect(Object.keys(shots.episodes).sort()).toEqual(ids);
    expect(Object.keys(visualQa).sort()).toEqual(ids);
    for (const id of ids) expect(shots.episodes[id]).toHaveLength(8);
  });

  it("records immutable checksums for both reference series", () => {
    const manifest = readJson(resolve(v1, "reference/checksums.json"));
    const masters = manifest.files.filter(({path}: {path: string}) => path.endsWith(".mp4"));

    expect(masters.filter(({locale}: {locale: string}) => locale === "fr-FR")).toHaveLength(5);
    expect(masters.filter(({locale}: {locale: string}) => locale === "en-US")).toHaveLength(5);
    for (const file of manifest.files) expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("keeps OverlayMotion V2 disabled and logo-driven", () => {
    const config = readJson(resolve(root, "v2-overlay/config.example.json"));
    expect(config.enabled).toBe(false);
    expect(config.logoPath).toBeNull();
    expect(config).toHaveProperty("accountName");
    expect(config).toHaveProperty("scrimOpacity");
  });

  it("exposes a self-contained runner help command", () => {
    const output = execFileSync("node", [resolve(v1, "run.mjs"), "--help"], {encoding: "utf8"});
    expect(output).toContain("pnpm curious:v1");
    expect(output).toContain("verify-reference");
  });

  it("preserves the frozen French caption accent fallback", () => {
    const timeline = readJson(resolve(v1, "reference/fr-FR.timeline.json"));
    expect(timeline[0].captions[0]).toMatchObject({text: "Pourquoi le sang de la", accent: "la"});
  });
});

import { describe, expect, test } from "vitest";
import { CompositionPlanSchema } from "../src/domain/composition.js";

const colorLayer = { kind: "asset", startSeconds: 0, endSeconds: 10, asset: { kind: "color", hex: "#101020" } };
const captionsLayer = {
  kind: "captions",
  startSeconds: 0,
  endSeconds: 10,
  style: "dynamic",
  cues: [{ startSeconds: 0, endSeconds: 2, text: "hello" }]
};

const validPlan = {
  width: 1080,
  height: 1920,
  fps: 30,
  durationSeconds: 10,
  background: "#101020",
  layers: [colorLayer, captionsLayer]
};

describe("CompositionPlanSchema", () => {
  test("accepts a well-formed plan", () => {
    const plan = CompositionPlanSchema.parse(validPlan);
    expect(plan.layers).toHaveLength(2);
  });

  test("rejects layers outside the duration or inverted", () => {
    const escaping = structuredClone(validPlan);
    escaping.layers[0]!.endSeconds = 11;
    expect(() => CompositionPlanSchema.parse(escaping)).toThrow();
    const inverted = structuredClone(validPlan);
    inverted.layers[0]!.startSeconds = 5;
    inverted.layers[0]!.endSeconds = 4;
    expect(() => CompositionPlanSchema.parse(inverted)).toThrow();
  });

  test("rejects empty layers and unsupported dimensions", () => {
    expect(() => CompositionPlanSchema.parse({ ...validPlan, layers: [] })).toThrow();
    expect(() => CompositionPlanSchema.parse({ ...validPlan, width: 1920 })).toThrow();
    expect(() => CompositionPlanSchema.parse({ ...validPlan, durationSeconds: 0 })).toThrow();
  });

  test("rejects invalid asset kinds and invalid colors", () => {
    const urlAsset = {
      ...validPlan,
      layers: [{ kind: "asset", startSeconds: 0, endSeconds: 5, asset: { kind: "url", url: "https://x.test/a.png" } }]
    };
    expect(() => CompositionPlanSchema.parse(urlAsset)).toThrow();
    const badColor = structuredClone(validPlan);
    badColor.background = "red";
    expect(() => CompositionPlanSchema.parse(badColor)).toThrow();
  });

  test("accepts focal placement and rejects coordinates outside the image", () => {
    const placed = {
      ...validPlan,
      layers: [{
        ...colorLayer,
        placement: { fit: "cover", focalPoint: { x: 0.25, y: 0.4 } },
        textBackdrop: "scrim"
      }, captionsLayer]
    };
    expect(CompositionPlanSchema.parse(placed).layers[0]).toMatchObject({
      placement: { focalPoint: { x: 0.25, y: 0.4 } },
      textBackdrop: "scrim"
    });
    const invalid = {
      ...placed,
      layers: [{
        ...colorLayer,
        placement: { fit: "cover", focalPoint: { x: 1.2, y: 0.4 } },
        textBackdrop: "scrim"
      }, captionsLayer]
    };
    expect(() => CompositionPlanSchema.parse(invalid)).toThrow();
  });

  test("rejects caption cues with inverted timing", () => {
    const badCue = {
      ...validPlan,
      layers: [colorLayer, { ...captionsLayer, cues: [{ startSeconds: 3, endSeconds: 2, text: "nope" }] }]
    };
    expect(() => CompositionPlanSchema.parse(badCue)).toThrow();
  });
});

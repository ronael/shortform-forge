# Production Providers

This document records production decisions that must survive individual Codex
sessions. A provider remains replaceable; a successful POC is evidence for a
specific production profile, not ownership of the complete workflow.

## Validated Baseline: MoneyPrinterTurbo

MoneyPrinterTurbo 1.3.5 is the default production path for the
`narrated-montage` profile until a later POC produces a better result.

Validated on 2026-08-28 with the French actors Top 5 brief:

- supplied French script and six supplied local images;
- 1080x1920 H.264/AAC output;
- Edge TTS voice `fr-FR-VivienneMultilingualNeural`;
- accurate phrase-timed Edge subtitles;
- sequential four-second visual segments, transitions, and background music;
- final duration driven by the measured narration (23.43 seconds);
- generation completed successfully through the batch CLI;
- retained local evidence: `output/benchmarks/moneyprinterturbo-poc/`.

The result met the current minimum publication-quality bar in human feedback. Its
voice and subtitles are accepted. It is the closest complete result produced so
far and should be reused instead of rebuilding those capabilities.

### Suitable Formats

- voice-led news and explainers;
- cinema, history, science, technology, and general-interest facts;
- practical advice and short educational stories;
- narrated or Reddit-style stories;
- motivation and personal-development videos;
- travel destinations and visual discovery;
- simple Top N/listicles where narration and captions carry the structure;
- faceless stock-footage videos;
- simple product narration without strict brand graphics.

### Known Boundary

MoneyPrinterTurbo provides subtitle styling, rounded translucent subtitle
backgrounds, positioning, transitions, image motion, and music. Version 1.3.5
does not expose first-class per-scene fields for rank badges, separate names and
metrics, title cards, logos, brand frames, or calls to action. Those elements are
optional dressing, not a reason to reject an otherwise publishable render.

The actors POC did not validate automatic script or asset selection because both
were supplied. A topic-only POC must pass before delegating those two capabilities
by default. Non-portrait local images were also letterboxed rather than composed
full-frame, so asset selection should prefer portrait media or supply focal-aware
preprocessing.

Bundled music with unverified provenance is allowed with an explicit terminal
warning and recorded provenance status. This does not block generation or decide
publishability.

## Target Composition

Use the smallest chain that satisfies the brief:

```text
ProductionBrief
      |
      +-- narrated-montage --> MoneyPrinterTurbo --> QA
      |
      +-- editorial-dressed --> MoneyPrinterTurbo --> DressingProvider --> QA
```

The dressing stage must preserve the validated voice, caption timing, music, and
edit unless the comparison demonstrates a direct quality improvement.

## Dressing Provider Shortlist

### 1. Revideo - first local POC

Repository: https://github.com/midrender/revideo

- MIT-licensed, TypeScript, active in 2026, and approximately 4,000 GitHub stars
  when reviewed;
- parameterized TypeScript templates, headless rendering API, and React preview;
- can express animated text, shapes, images, and reusable scene components;
- best architectural fit for a replaceable local `DressingProvider`.

POC: take the existing MoneyPrinterTurbo actors MP4 as the base layer and add only
the title, rank, name, amount, and light scrim. Measure setup time, render time,
output quality, audio preservation, and adapter complexity. Delete the temporary
checkout and dependencies after retaining the final video and scorecard.

### 2. Creatomate - fastest external quality test

Documentation: https://creatomate.com/docs/api/quick-start/create-a-video-by-template

- visual template editor plus a JSON RenderScript representation;
- dynamic text, footage, colors, timing, and optional scene removal through one
  render API;
- strong candidate for quickly testing whether professional templates beat local
  engines enough to justify a paid provider.

POC only when trial credits or an API key are available. Keep its template ID and
render payload behind a provider boundary.

### 3. Shotstack - external JSON/template alternative

Documentation: https://shotstack.io/docs/guide/architecting-an-application/templates/

- layered timeline JSON, reusable templates, merge fields, visual Studio, CLI,
  and render API;
- good fit for deterministic overlays and brand templates;
- compare with Creatomate rather than integrating both.

### 4. Remotion and OverlayMotion - proven benchmark

Repositories and templates:

- https://github.com/remotion-dev/remotion
- https://overlaymotion.com/

The existing OpenMontage actors render already proves that the Remotion ecosystem
can produce the desired structured editorial dressing. It remains the visual
benchmark and a source of template ideas. Recheck the current Remotion commercial
license before making it a core dependency; OverlayMotion may reduce template
work but does not remove that licensing consideration.

### 5. Editly - lower-priority local fallback

Repository: https://github.com/mifi/editly

Editly is MIT-licensed and supports declarative text, Canvas/Fabric.js overlays,
transitions, picture-in-picture, audio ducking, and 9:16 output. Its repository
was less active than Revideo when reviewed, and its default letterboxing overlaps
with a weakness already observed in MoneyPrinterTurbo. Use it only if Revideo is
too costly or unreliable to operate locally.

Motion Canvas is not a separate first POC because Revideo already adapts its model
for headless, parameterized video rendering. It remains relevant for bespoke
explainer animation rather than lightweight post-dressing.

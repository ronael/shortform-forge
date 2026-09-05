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

### Duration and Scene Timing

The actors POC requested 30 seconds but produced 23.43 seconds because the
supplied script and measured TTS duration became the effective output duration.
The script contained 54 words; at the measured rate of about 138 words per
minute, a 30-second result needs approximately 69 words. The unused 6.57 seconds
are editorial capacity, not time to fill with silence or time stretching. A
duration target must influence the script word budget before synthesis, then be
checked against the measured voice track. Warn when the result misses the
requested duration materially and recommend a script adjustment.

The same POC used fixed four-second image blocks while narration sections had
unequal durations. This can leave the previous subject visible after the dialogue
has moved on. Asset timing must use dialogue-section timestamps, with intentional
holds or faster cuts where the brief calls for them, rather than one global clip
duration.

For a ranking, each rank announcement is the semantic cut anchor. The subject
image, rank, name, and metric must start together on that anchor and remain until
the next rank announcement. Intro and outro are separate sections. In the
23.43-second actors voice track, the measured anchors were approximately 3.64 s
for Brad Pitt, 7.12 s for Scarlett Johansson, 10.58 s for Mark Wahlberg, 13.93 s
for Tom Cruise, 16.91 s for Adam Sandler, and 19.89 s for the outro. These values
are evidence, not reusable constants: every regenerated voice track must produce
its own anchors before the visual timeline is assembled.

## Target Composition

Use the smallest chain that satisfies the brief:

```text
ProductionBrief
      |
      +-- real-video edit --> MoneyPrinterTurbo
                                  |
                                  +-- captions/text dressing --> Remotion --> QA
```

MoneyPrinterTurbo owns the primary footage selection/order and visual edit.
Remotion owns captions and structured text dressing only: titles, rank badges,
names, metrics, progress, and calls to action. Full-frame illustrative motion
design is not the default production path. The dressing stage must preserve the
validated voice, narration timing, music, and edit unless a comparison
demonstrates a direct quality improvement.

Human review on 2026-08-30 selected Remotion over Revideo V4 for the ranking
profile. Both results were considered good, but Remotion won because its text
framing and alignment remained correct throughout the video. This is a
profile-level decision, not permanent coupling: keep the dressing contract
replaceable and retain Revideo as the local fallback.

Human review also accepted five French `curious-question` videos and requested
their English localization for publication. The frozen provider chain, bilingual
design direction, timing rules, and QA bar are recorded in
`docs/CURIOUS_QUESTIONS_PROFILE.md`. Treat that document as the default for this
format. Do not restart provider comparisons unless a concrete defect or measured
quality/cost improvement justifies it.

## Dressing Provider Shortlist

### 1. Revideo - capability proven, first template rejected

Repository: https://github.com/midrender/revideo

- MIT-licensed, TypeScript, active in 2026, and approximately 4,000 GitHub stars
  when reviewed;
- parameterized TypeScript templates, headless rendering API, and React preview;
- can express animated text, shapes, images, and reusable scene components;
- best architectural fit for a replaceable local `DressingProvider`.

The 2026-08-28 POC took the existing MoneyPrinterTurbo actors MP4 as the base
layer and added only a title, rank, name, amount, and light scrim. It rendered in
6.57 seconds at 1080x1920 and preserved the source duration, voice, captions,
music, and loudness within measurement tolerance. The retained candidate and
scorecard are under `output/benchmarks/revideo-dressing-poc/`.

The technical result supports Revideo as a lightweight downstream dressing
provider, but human review rejected this template: its light overlay backgrounds
add visual noise and its alignment is not consistent enough. A later POC may
reuse the engine with a strict alignment grid and no decorative backgrounds;
this composition is not the default. Revideo 0.11.0 also required explicit
installation of its Vite plugin, UI, and telemetry packages, plus the browser
video decoder for this H.264 input; an adapter should hide those runtime details
if adopted. The temporary checkout and dependency environment are not retained.

A V2 technical POC now isolates the brief/template variable. It removes panels
and secondary labels, uses one top-left grid with text shadow only, and switches
the rank/name/metric group on narration anchors. Frame QA passed after correcting
Revideo's center-origin layout coordinates. Human review is pending at
`output/benchmarks/revideo-dressing-v2-poc/`. Acceptance would show that the V1
failure was primarily ours at the brief/template level; rejection would justify
testing the same minimal brief with another dressing provider.

An animated V3 POC proves the complete correction path at
`output/benchmarks/revideo-animated-30s-poc/`. A 73-word script produced 29.88
seconds of accepted Edge TTS speech and a 29.93-second final render. Revideo now
drives focal-aware portraits, rank/name/metric reveals, and short caption groups
from the same measured narration anchors. Technical QA passed; human review is
pending. This test shows that Revideo can supply restrained animation and that
the earlier 23-second and portrait-lag defects were upstream timeline inputs,
not fixed limits of the dressing engine.

A retention-oriented V4 at `output/benchmarks/revideo-retention-v4-poc/` pushes
the same timeline further with a staged hook, giant rank flashes, a five-step
progress rail, portrait motion, and animated short caption groups. It preserves
the accepted Vivienne voice and avoids the rejected dressing panels. Technical
QA passed after correcting a cumulative transition-wait offset. Human review
considered the result good but selected Remotion because its text framing and
alignment were more consistent. Revideo remains the fallback, not the preferred
ranking dressing provider.

### 2. Creatomate - fastest external quality test

Documentation: https://creatomate.com/docs/api/quick-start/create-a-video-by-template

- visual template editor plus a JSON RenderScript representation;
- dynamic text, footage, colors, timing, and optional scene removal through one
  render API;
- strong candidate for quickly testing whether professional templates beat local
  engines enough to justify a paid provider.

The 2026-08-30 unauthenticated render probe reached the official endpoint and
returned the expected HTTP 401 without creating a job or consuming credits. A
real POC still requires a project API key or connected MCP account. Keep its
template ID and render payload behind a provider boundary. Current pricing makes
this a quality benchmark rather than a default local dependency.

### 3. Shotstack - external JSON/template alternative

Documentation: https://shotstack.io/docs/guide/architecting-an-application/templates/

- layered timeline JSON, reusable templates, merge fields, visual Studio, CLI,
  and render API;
- good fit for deterministic overlays and brand templates;
- compare with Creatomate rather than integrating both.

The 2026-08-30 stage-endpoint probe returned the expected HTTP 401 without a
stage key. No visual claim is made. The sandbox is only useful after account
creation and still requires an active credit balance.

### 4. Remotion and OverlayMotion - direct POC completed

Repositories and templates:

- https://github.com/remotion-dev/remotion
- https://overlaymotion.com/

The existing OpenMontage actors render proved that the Remotion ecosystem can
produce structured editorial dressing. A direct Remotion 4.0.518 POC now reuses
the exact Revideo V4 audio, images, captions, section anchors, dimensions, and
duration. It renders spring-based title, rank, caption, progress, and portrait
animations at 1080x1920 in 29.99 seconds; technical QA passed and the result is at
`output/benchmarks/remotion-ranking-poc/`. The contact sheet exposes one bright
portrait where white title contrast is weak, confirming that dynamic text
contrast belongs in the production brief for either engine. Human comparison on
a phone selected Remotion as the winner: all text was correctly framed and
aligned throughout the video, with no visible layout error. Remotion is therefore
the preferred `DressingProvider` candidate for structured ranking videos. Recheck
the current Remotion license before making it a core dependency; OverlayMotion
may reduce template work but does not remove that consideration.

OverlayMotion 0.8.0 was then tested directly on 2026-08-30. Its update check,
143 tests, and TypeScript check passed. A real 1080x1920, 30 fps render combined
the free `hero-title` and `logo-sting` templates with bundled sound effects and a
CC0 jingle. The output and exact spec are retained under
`output/benchmarks/provider-sweep-2026-08-30/overlaymotion/`. This validates it
as a useful Remotion template kit, not as a replacement editor. Its first
production comparison should add only the question open, restrained callouts,
and branded outro over a MoneyPrinterTurbo real-footage edit.

That production-scale comparison was completed on 2026-08-31 against the
accepted 30-second flamingo hybrid. OverlayMotion replaced the opening with a
question card and the ending with a branded `logo-sting`, while preserving the
Vivienne voice, main edit, captions, music, and existing jingle. The result is
30.06 seconds and is retained at
`output/benchmarks/overlaymotion-full-video-poc/`. Initial human feedback is
strongly positive. The test also confirms that the logo, account name, tagline,
accent, and theme are render properties: a transparent PNG or SVG can replace
the temporary generated `CM` monogram without changing the engine.

A V2 follow-up replaced the white opening and ending plates with central crops
from the authorized flamingo footage, protected by a 55 percent black scrim and
a restrained 3.5 percent move. This keeps the topic visually identifiable while
the registered `hero-title` and `logo-sting` remain dominant. The 30.06-second
render passed format, checkpoint, and audio QA at -15.0 LUFS / -1.3 dBTP and is
retained at `output/benchmarks/overlaymotion-full-video-v2-poc/`. Prefer this
illustrated treatment over a flat white plate for future OverlayMotion opens and
outros. Human phone review is still the final acceptance gate.

OverlayMotion can also own callouts, ranking titles, lower thirds, and caption
templates. The retained flamingo source already had internal titles burned in,
so this comparison intentionally changed only the opening and ending. Preserve
a clean pre-dressing master in future productions before moving all editorial
text into OverlayMotion. Treat it as the preferred reusable template library to
integrate behind the existing `DressingProvider` boundary, not as the primary
editor.

OverlayMotion is source-available rather than OSI open source. Rendered outputs
may be commercialized, but source redistribution and hosted-template use are
restricted. Preserve its notices and recheck both its license and Remotion's
license before adoption.

## OpenMontage and HyperFrames POC

OpenMontage was installed from a temporary checkout on 2026-08-30. Its 1,210
contract tests passed with seven skips, HyperFrames 0.8.20 passed its runtime
doctor, and the pre-authored `code-to-screen` Remotion demo rendered successfully
at 1920x1080 for 25.05 seconds. This proves the renderer and package graph, not
automatic short-form production. Image generation, video generation, and most
TTS providers remained unconfigured in the provider preflight.

The OpenMontage HyperFrames adapter also completed a six-second 1080x1920 render
with lint, browser validation, and WCAG contrast checks passing. The resulting
vertical typography is much too small for a phone. The adapter's input schema
also documents `tiktok_vertical`, while the actual media profile registry accepts
`tiktok`. HyperFrames is therefore a valid local renderer but not a production
provider through this adapter yet. Retained evidence is under
`output/benchmarks/provider-sweep-2026-08-30/openmontage/`.

A second direct HyperFrames POC on 2026-08-31 used ten seconds of the real
MoneyPrinterTurbo actors ranking instead of an automatically generated layout.
It produced a large animated hook, progress rail, rank, name, and amount over the
existing footage. Lint passed with no errors or warnings, and browser runtime,
layout, and contrast checks passed with no findings at the sampled frames. The
result at `output/benchmarks/hyperframes-concrete-poc/` proves HyperFrames can
produce phone-ready bespoke dressing when the layout is deliberately authored.
It remains more engineering-heavy than OverlayMotion, so keep it as an
experimental alternative for custom motion systems rather than the default.

Piper `fr_FR-siwis-medium` produced a local French WAV successfully, but human
review found it noticeably more robotic than the accepted Vivienne voice. Reject
it for publication output. It may remain a zero-cost offline draft or emergency
fallback only.

OpenMontage is AGPL-3.0 and agent-first. Its full production pipelines also add
their own proposal and approval governance. Use it as an experimental complete
system or a source of provider ideas, not as a core dependency hidden behind a
thin `EditingProvider` adapter. Human review of the pre-authored demo also found
multiple color, text-background, and sizing problems. Do not integrate it into
the default production path from the current evidence.

## WanGP / Wan2GP Static POC

Repository: https://github.com/deepbeepmeep/Wan2GP

WanGP 12.647 was audited at revision
`071ce70aab1169c61cc14bbefd71bdda3a04a9e9` on 2026-08-31. It is not an editor
or dressing provider. Its relevant role is an external `VideoProvider` for short
shots that cannot be sourced economically from authorized real footage.

The integration surface is unusually strong for this category: an in-process
Python API with structured jobs and progress, JSON/ZIP headless queue processing,
and an MCP server. The static POC confirmed that the API exposes single-task and
batch submission plus model metadata/schema discovery. Built-in resolution
choices include 480x832, 544x960, 720x1280, and 1088x1920, so portrait output
does not require a horizontal-first workaround.

The Apple M1 Max was detected correctly as the supported MPS/SDPA profile, then
a real temporary environment generated a 49-frame, 480x832, 16 fps clip with
Wan2.1 T2V 1.3B. Twenty steps took 25 minutes 12 seconds after weights were
present. The temporary checkout, environment, and auto-downloaded checkpoints
reached 20 GB; macOS reported a 7.52 GB maximum RSS and 18.98 GB peak memory
footprint. The first headless run also exposed a real contract defect:
`force_fps` is numeric in the API example, but the CLI generation path calls
`len()` and requires a string.

The retained clip is technically valid and stable, but it fails editorial QA.
Its centered object becomes a bright hollow shape without a readable shell
rupture or coherent popcorn expansion. It would not improve the accepted stock
edit, so Wan2.1 T2V 1.3B on this Mac is rejected for publication use. Evidence
and exact settings are under `output/benchmarks/wangp-mps-poc/`; the 20 GB
runtime and model cache were deleted after measurement. Static checks still
passed for 474 JSON files and bundled shell scripts, while compilation found one
unrelated indentation error in the optional LongCat block-sparse module.

Run the first GPU benchmark on the 16 GB RTX 4080 with Wan 2.2 TI2V 5B FastWan,
profile 4, SDPA, 121 frames, three steps, and 720x1280 output. Compare one
text-to-video clip and one image-to-video clip at the same seed, then optionally
repeat with SageAttention. The retained benchmark plan is at
`output/benchmarks/wangp-static-poc/rtx4080-poc-manifest.json`. Generated footage
must remain a replaceable input to MoneyPrinterTurbo; Remotion or OverlayMotion
continues to own captions and editorial dressing.

WanGP uses a custom community license rather than an OSI license. Private and
internal production use plus publication of outputs are allowed. Paid hosted,
API, embedded, white-label, or SaaS access to WanGP is restricted, and direct
sales of generated outputs require reasonable WanGP credit. Model, checkpoint,
LoRA, and dataset licenses remain separate and must be recorded per generation.

## HeliosGen POC

HeliosGen installed, built, and served locally in guest mode on 2026-08-30. The
gallery UI responded successfully. A video request stopped truthfully with a
missing Kie.ai key, and the legacy image route stopped with a missing Replicate
token. No model-quality claim is possible without those paid credentials.

Its optional `codex-imagegen-cli` path passed a dry-run but only 22 of 23 upstream
tests passed. More importantly, the alpha wrapper calls a private ChatGPT Codex
backend endpoint directly. Do not adopt that wrapper as a production provider.
HeliosGen remains useful as an orchestration/UI reference and can be compared
later when a Kie.ai or Replicate budget is explicitly approved.

## Topic-Only MoneyPrinterTurbo POC

The first truthful topic-only run used only a French subject and no prepared
script or media. MoneyPrinterTurbo 1.3.5 accepted the task but stopped during
script generation because no Moonshot API key was configured. The retained
evidence is under `output/benchmarks/moneyprinterturbo-topic-only-poc/`. This
validates the CLI entry path only; automatic script and asset quality remain
untested until one supported LLM and one stock provider are configured.

Current MoneyPrinterTurbo upstream now supports keyless Ollama and LiteLLM for
script generation. This machine has no running Ollama service or downloaded
model, and stock search still needs a provider key unless local media is supplied.
The future RTX 4080 host is a sensible place to test Ollama, but it does not
remove the separate stock-footage requirement.

## Social-Question Popcorn Comparison

A second-format comparison now uses the same 72-word Vivienne master and Edge
subtitle timeline for two 30.5-second outputs. MoneyPrinterTurbo 1.3.5 assembled
real Pexels video clips at
`output/benchmarks/popcorn-moneyprinter-video-poc/`. Its native render exposed a
blocking asset-input constraint: horizontal clips are letterboxed rather than
cropped around a focal point. Eight upstream 9:16 preparations removed that
defect and produced a technically usable final. This validates real-video
composition, not automatic stock search or semantic timing.

Remotion 4.0.518 rendered a pure motion-design interpretation at
`output/benchmarks/popcorn-remotion-motion-poc/`, with no external visual asset.
Technical contact-sheet QA passed for the explanatory scenes, text grid,
subtitles, audio, and duration. Human review rejected the full motion-design
result as visually unattractive despite its checklist compliance. The same review
accepted Remotion's subtitle and text handling, while preferring the
MoneyPrinterTurbo real-video result as the visual base.

The selected production composition for this format is therefore:

```text
focal-prepared real video
        |
MoneyPrinterTurbo visual edit
        |
Remotion captions and text dressing
        |
QA and human review
```

The Vivienne voice remains a good free baseline, but this render sounded too
flat for social content. This is not yet evidence to replace the voice provider:
the shared master was slowed to `0.82x` to stretch a 72-word script to 30 seconds.
The next comparison must synthesize at natural rate and increase the script word
budget to reach the duration target. Only test another free voice if the natural
rate result still lacks energy.

### 5. Editly - lower-priority local fallback

Repository: https://github.com/mifi/editly

Editly is MIT-licensed and supports declarative text, Canvas/Fabric.js overlays,
transitions, picture-in-picture, audio ducking, and 9:16 output. Version
0.15.0-rc.1 could not install on the current Apple Silicon toolchain: its native
`gl` dependency had no compatible prebuilt binary and failed to compile against
modern Node/V8 headers. A compatibility attempt was intentionally stopped after
the same native boundary failed. Reject it for this project; Remotion and
OverlayMotion already cover the useful capability with a working toolchain.

Motion Canvas is not a separate first POC because Revideo already adapts its model
for headless, parameterized video rendering. It remains relevant for bespoke
explainer animation rather than lightweight post-dressing.

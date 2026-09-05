# Curious Questions Production Profile

This document freezes the accepted production direction for bilingual
`curious-question` videos. It is a profile-level decision, not a permanent
dependency on any provider.

## Status

- Profile: `curious-question-v1`
- Accepted by human review: 2026-08-30
- Languages: French and English
- Target duration: 30 seconds, accepted range 29.0 to 30.5 seconds
- Publication decision: human review remains required

The durable, versioned recipe is
`production-profiles/bizarrement-curieux/v1/`. Generated French reference media
is retained under `output/series/questions-insolites-fr-v1/`; English reference
media is retained under `output/series/curious-questions-en-v1/`. Those output
directories are recoverable evidence, not the source of truth for the recipe.

The exact reference checksums and the future GitHub release contract live under
`production-profiles/bizarrement-curieux/v1/reference/`. The release remains
local until explicit owner approval. A new conversation must start with
`production-profiles/bizarrement-curieux/v1/NEW_CONVERSATION.md`.

## Provider Chain

```text
verified subject and script
        |
measured natural-speed Edge TTS
        |
focal-prepared licensed real footage
        |
MoneyPrinterTurbo 1.3.5 visual edit
        |
Remotion 4.0.518 captions and editorial dressing
        |
deterministic QA and human review
```

MoneyPrinterTurbo owns the real-footage rhythm. Remotion owns the question
open, short editorial callouts, dynamic captions, and outro. Full motion design
is not the default for this profile.

## Shared Direction

Keep approximately 75 percent of the identity common across both languages:

- 1080x1920, 9:16, 30 fps, H.264 video and 48 kHz AAC audio;
- the same typography, alignment grid, caption behavior, component set, music
  signature, and 30-second narrative structure;
- an immediate question, progressive explanation, memorable resolution, and
  short branded outro;
- real moving footage rather than photographs animated with digital pans;
- one editorial idea at a time and no decorative transitions without a
  narrative purpose.

The remaining 25 percent must be localized:

- scripts are rewritten idiomatically rather than translated literally;
- French uses `fr-FR-VivienneMultilingualNeural` with warm yellow/coral
  accents;
- English uses `en-US-AvaMultilingualNeural` with cyan/green accents;
- each localized edit changes the opening shot and at least two later shot
  choices or timings;
- hooks, callouts, outro copy, descriptions, and metadata are native to the
  language;
- no exported platform watermark is reused between accounts.

This is enough differentiation for a coherent bilingual brand while avoiding
identical video binaries.

## Timing Rules

- Synthesize at natural `1.0x` speed before finalizing the timeline.
- Measure the actual voice and word timestamps; word count is only a first
  estimate.
- Adjust the script, never the playback speed, when the voice misses the target.
- Aim for narration to finish between 28.5 and 29.85 seconds.
- Use the remaining frames for the resolution and outro, not silent filler.
- Rebuild all shot and caption anchors from the final voice file.

## Visual Rules

- Audit footage availability before selecting a subject.
- Prefer portrait footage; otherwise prepare a focal-aware 9:16 crop upstream.
- Keep the subject inside the central safe area after the real crop is rendered.
- Use at least three visually distinct situations in a 30-second episode.
- Every shot must illustrate or directly prepare the current spoken idea.
- Keep a fallback for every essential asset and retain source/license metadata.
- Reject watermarks, embedded subtitles, unidentified reposts, and unknown or
  non-commercial licenses.

## Dressing Rules

- Show the format label within 0.5 seconds and the complete question by 1.6
  seconds.
- Keep editorial titles to four words or two lines where possible.
- Captions contain two to six words, at most two lines, with one accent per
  group.
- Accent animation must not move the whole caption line.
- Use a restrained contrast scrim only where footage requires it.
- The outro must resolve the music and image; never end on a hard cut.

## Audio Rules

- Voice must remain intelligible and emotionally directed sentence by sentence.
- Target integrated loudness is -15 LUFS, accepted range -14 to -16 LUFS.
- True peak must not exceed -1 dBTP.
- Music stays below the voice and rises only enough to support the reveal/outro.
- Retain provenance for the music bed and jingle. Platform rights handling does
  not block generation, but provenance must remain available for human review.

## Required QA

- exact technical duration and 900 rendered frames for a 30-second master;
- 1080x1920, 30 fps, 48 kHz stereo;
- no black frame sequence, clipping, caption overlap, or safe-zone violation;
- visual contact sheet reviewed for focal crops and text alignment;
- each factual claim linked to a consulted source;
- the main reveal supported by two independent sources before publication;
- human review of facts, footage rights, voice, rhythm, and perceived quality.

## Change Policy

This profile is now the default for bilingual curious questions. Do not restart
provider or template experiments for this format without a concrete defect or a
measured quality/cost advantage. Other video formats may use different profiles
and providers without changing this baseline.

OverlayMotion work belongs to the inactive
`production-profiles/bizarrement-curieux/v2-overlay/` profile. A future logo,
account name, tagline, accent, theme, and opening/outro imagery are render
properties there. Do not activate V2 or alter the approved V1 while the account
art direction is still under review.

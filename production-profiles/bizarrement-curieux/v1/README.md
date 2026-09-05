# Bizarrement Curieux V1

This is the frozen production profile behind the five French and five English
videos accepted on 2026-08-30. V1 is a visual and operational baseline, not a
fixed timeline: every new script gets a newly synthesized voice, measured
captions, and subject-specific shot plan.

## Commands

Run commands from the repository root:

```bash
pnpm curious:v1 doctor --locale fr-FR
pnpm curious:v1 verify-reference --locale fr-FR
pnpm curious:v1 all --locale fr-FR --episode <episode-id> \
  --asset-root /absolute/path/to/authorized-assets \
  --mpt-root /absolute/path/to/MoneyPrinterTurbo \
  --audio-root /absolute/path/to/reference-audio
```

Individual stages are `voice`, `prepare-assets`, `base-edit`, `timeline`,
`render`, `normalize`, `qa`, and `package-release`. Use `--help` for the exact
inputs. The default generated root is `output/production/bizarrement-curieux-v1`.

## Frozen Decisions

- Natural-speed Vivienne in French and Ava in English.
- Licensed real footage prepared to 9:16 before MoneyPrinterTurbo.
- MoneyPrinterTurbo 1.3.5 owns the base edit.
- Remotion 4.0.518 owns the question open, callouts, captions, and outro.
- Exactly 1080x1920, 30 fps, and 900 frames.
- The final timeline follows measured speech, never copied timings.
- V1 is not changed to test a provider. Experiments use a new profile version.

The exact Edge TTS package version used by the original POC was not recorded,
so the profile does not invent one retroactively. The accepted voice files are
part of the reference archive. Regenerating an old reference voice is therefore
a new artifact requiring comparison; future episodes continue to use the locked
voice name and natural rate.

## Inputs And Outputs

`locales/<locale>/episodes.json` contains scripts and verified sources.
`editorial.json` contains the accepted titles, accent vocabulary, and callout
semantics. `shot-plan.json` contains focal preparation instructions and source
file names. `visual-qa.json` defines the subject that must be visible and rejects
lookalike or unrelated footage, including the previously observed monkey/wombat
mismatch. `assets.json` preserves source pages and license references.

The runner writes only below `output/`. It does not download media, publish,
commit, or push. Source footage must be supplied locally after rights review.
Reference media can later be hydrated from the GitHub release described by
`reference/release-manifest.json`; its URL intentionally remains null until the
owner approves publication of the release.

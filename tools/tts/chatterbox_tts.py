"""SF_TTS_COMMAND adapter for local Chatterbox Multilingual TTS."""

import argparse
import os
import sys

import torch
import torchaudio
from chatterbox.mtl_tts import ChatterboxMultilingualTTS


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("output")
    parser.add_argument("--language", default="fr")
    args = parser.parse_args()

    text = sys.stdin.read().strip()
    if not text:
        raise SystemExit("No text received on stdin")

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    model = ChatterboxMultilingualTTS.from_pretrained(device=device)
    torch.manual_seed(int(os.getenv("SF_CHATTERBOX_SEED", "42")))
    audio = model.generate(
        text,
        language_id=args.language,
        exaggeration=float(os.getenv("SF_CHATTERBOX_EXAGGERATION", "0.7")),
        cfg_weight=float(os.getenv("SF_CHATTERBOX_CFG_WEIGHT", "0.3")),
    )
    torchaudio.save(args.output, audio.cpu(), model.sr)


if __name__ == "__main__":
    main()

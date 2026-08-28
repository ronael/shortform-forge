"""Batch Chatterbox adapter: load the local model once for a whole video."""

import argparse
import json
import os

import torch
import torchaudio
from chatterbox.mtl_tts import ChatterboxMultilingualTTS


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("request", help="JSON array of {text, outputPath} items")
    parser.add_argument("--language", default="fr")
    args = parser.parse_args()

    with open(args.request, "r", encoding="utf-8") as handle:
        items = json.load(handle)
    if not isinstance(items, list) or not items:
        raise SystemExit("Batch request must contain at least one item")

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    model = ChatterboxMultilingualTTS.from_pretrained(device=device)
    seed = int(os.getenv("SF_CHATTERBOX_SEED", "42"))
    exaggeration = float(os.getenv("SF_CHATTERBOX_EXAGGERATION", "0.7"))
    cfg_weight = float(os.getenv("SF_CHATTERBOX_CFG_WEIGHT", "0.3"))

    for index, item in enumerate(items):
        torch.manual_seed(seed + index)
        audio = model.generate(
            item["text"],
            language_id=args.language,
            exaggeration=exaggeration,
            cfg_weight=cfg_weight,
        )
        torchaudio.save(item["outputPath"], audio.cpu(), model.sr)


if __name__ == "__main__":
    main()

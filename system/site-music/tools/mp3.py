#!/usr/bin/env python
"""Write an MP3 listening copy beside each WAV in a folder.

    python system/site-music/tools/mp3.py FOLDER

Uses the soundfile library (libsndfile's own MP3 writer). The WAV stays the master; the MP3 is for devices that do not
play WAV. Nothing is played.
"""
import pathlib
import sys

import soundfile as sf


def main(folder: str) -> int:
    root = pathlib.Path(folder)
    wavs = sorted(root.glob("*.wav"))
    if not wavs:
        print(f"no WAV files in {root}", file=sys.stderr)
        return 1
    for wav in wavs:
        data, rate = sf.read(str(wav), dtype="float32")
        out = wav.with_suffix(".mp3")
        sf.write(str(out), data, rate, format="MP3", subtype="MPEG_LAYER_III")
        print(f"{out.name}: {out.stat().st_size / 1e6:.2f} MB from {wav.stat().st_size / 1e6:.1f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "."))

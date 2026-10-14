"""Build a film whose scene imports a vendored raw-native tree (media/raw-native/tree-<sha>/), and a
film's first render, when it has no receipt yet. Everything else is motion.py, unchanged, so the
live films' receipts, which hash motion.py as render code, stay valid.

    python -m tools.explainer.film.motion_tree media/explainers/<slug> --narration DIR --raw-native DIR \
        [--seconds S] [--master DIR] [--width 3840 --height 2160] [--poster-at 50] [--bare]

--seconds is the scene's duration (the scene computes it from timing.json in JavaScript); it is
needed only for a first render.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from tools.explainer.film import motion


class _Engine(type(Path())):
    """An engine folder whose `name` is its path under media/raw-native/, because motion.py builds
    the capture page's address from engine_dir(...).name (one segment for web-<sha>, two here)."""
    @property
    def name(self) -> str:
        import os
        base, parent = super().name, os.path.basename(os.path.dirname(str(self)))
        return f"{parent}/{base}" if base == "web" and parent.startswith("tree-") else base


def engine_dir(scene: Path) -> Path:
    """media/raw-native/web-<sha>/ (the web folder alone) or media/raw-native/tree-<sha>/web/."""
    m = re.search(r'"(?:\.\./)+raw-native/(web-[\w-]+|tree-[0-9a-f]+/web)/motion/', scene.read_text(encoding="utf-8"))
    if not m:
        sys.exit("film.scene.mjs imports no vendored raw-native web folder")
    return _Engine(motion.ROOT / "media" / "raw-native" / m.group(1))


def first_receipt(folder: Path, narration: Path, seconds: float) -> dict:
    film = json.loads((folder / "film.json").read_text(encoding="utf-8"))
    nar = json.loads((narration / "narration.json").read_text(encoding="utf-8"))
    frames = round(seconds * motion.FPS)
    return {"schema": "explainer-film-receipt/1", "slug": film["slug"], "title": film["title"], "page": film["page"],
            "script": {"path": f"media/explainers/{film['slug']}/film.json", "sha256": motion.sha(folder / "film.json")},
            "evidence": {"path": f"media/explainers/{film['slug']}/evidence.json", "sha256": motion.sha(folder / "evidence.json")},
            "narration": {"wav_sha256": motion.sha(narration / "narration.wav"), **nar},
            "frames": frames, "fps": motion.FPS, "seconds": round(frames / motion.FPS, 3)}


def code_files(folder: Path) -> list[Path]:
    """motion.py's list, read through engine_dir() above, plus this file."""
    return [*motion.code_files(folder), Path(__file__)]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("folder", type=Path)
    ap.add_argument("--narration", type=Path, required=True)
    ap.add_argument("--raw-native", type=Path, required=True)
    ap.add_argument("--master", type=Path, default=Path("masters"))
    ap.add_argument("--width", type=int, default=3840)
    ap.add_argument("--height", type=int, default=2160)
    ap.add_argument("--poster-at", type=float, default=50.0)
    ap.add_argument("--seconds", type=float)
    ap.add_argument("--bare", action="store_true")
    a = ap.parse_args()
    folder = a.folder.resolve()
    receipt = folder / "film.receipt.json"
    if not receipt.is_file():
        if not a.seconds:
            sys.exit("a first render needs --seconds: the scene's duration")
        receipt.write_text(json.dumps(first_receipt(folder, a.narration.resolve(), a.seconds), indent=2) + "\n", encoding="utf-8", newline="\n")
    motion.engine_dir = engine_dir
    base_code = motion.code_files
    motion.code_files = lambda f: [*base_code(f), Path(__file__)]
    rec = motion.build(folder, a.narration.resolve(), a.raw_native.resolve(), a.master.resolve(), a.width, a.height, a.poster_at, a.bare)
    receipt.write_text(json.dumps(rec, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(rec["outputs"], indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())

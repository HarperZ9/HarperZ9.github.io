"""The trailer's per-frame compositing (tools/explainer/film/trailer.py), shared by the video and --still.

A still of the trailer must show the game's recorded frame under the card layer, not the layer alone.
The recorded frames live outside the repository, so these tests build a synthetic shot.
"""

from pathlib import Path

import numpy as np
from PIL import Image

from tools.explainer.film.trailer import Trailer, main

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / "media" / "explainers" / "keepers-hour-trailer"
W, H = 320, 180


def shot_frames(tmp_path: Path, colour=(200, 60, 30)) -> Path:
    """Shot s01 (sweeps 1 to 3): every frame a flat colour at the recorder's 16:9 size."""
    d = tmp_path / "frames" / "s01"
    d.mkdir(parents=True)
    for k in (0, 30):
        Image.new("RGB", (128, 72), colour).save(d / f"frame-{k:05d}.ppm")
    return tmp_path / "frames"


def test_a_frame_inside_a_shot_shows_the_game_under_an_empty_layer(tmp_path):
    tr = Trailer(FOLDER, shot_frames(tmp_path), W, H)
    out = tr.frame(30, np.zeros((H, W, 3), np.uint8))
    centre = out[H // 2, W // 2]
    assert centre[0] > 120 and centre[0] > centre[1] > centre[2], centre  # the game's colour, vignetted and plated


def test_full_layer_coverage_replaces_the_game(tmp_path):
    tr = Trailer(FOLDER, shot_frames(tmp_path), W, H)
    layer = np.full((H, W, 3), 236, np.uint8)
    assert (tr.frame(30, layer) == 236).all()


def test_still_cli_writes_a_composite_png(tmp_path):
    layer = tmp_path / "layer.png"
    Image.new("RGB", (W, H), (0, 0, 0)).save(layer)
    out = tmp_path / "still.png"
    assert main([str(FOLDER), "--frames", str(shot_frames(tmp_path)), "--still", "30", "--layer-png", str(layer),
                 "--out", str(out), "--width", str(W), "--height", str(H)]) == 0
    px = np.asarray(Image.open(out))[H // 2, W // 2]
    assert px[0] > 120, px  # control: the layer alone is black here

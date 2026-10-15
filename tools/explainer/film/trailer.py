"""Assemble a game trailer: the game's own recorded frames, cut to its film.json, under the
Motion layer of its film.scene.mjs.

    python -m tools.explainer.film.trailer media/explainers/keepers-hour-trailer \\
        --frames DIR --overlay OVERLAY.mp4 --out OUT.mp4 [--width 1920 --height 1080]

DIR holds one folder per shot of capture.json, named sNN after the shot's first sweep, with the
recorder's frame-00000.ppm onwards. OVERLAY is the Motion layer rendered at the same size and
frame rate (scripts/motion_render.py). In the card sweeps that layer is words in bone on black,
so its pixels are the words' colour times their coverage: each output pixel is the game frame
times (1 - coverage) plus the layer. The game frame is pushed in by a centred crop (capture.json
"push", smootherstep over the shot, about its "focus" point; with "pad" the crop may pass the frame edge, in black), a soft plate darkens the card's corner while a card shows,
and a vignette closes the edges. In the title and end-card sweeps the layer is the whole frame.
Every frame is a function of its index: two runs give the same bytes for the same inputs.
"""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image


def smooth(u: float) -> float:
    u = min(1.0, max(0.0, u))
    return u * u * u * (u * (u * 6 - 15) + 10)


def window(t: float, a: float, b: float, up: float, down: float) -> float:
    return min(smooth((t - a) / up), 1 - smooth((t - (b - down)) / down))


def ffmpeg() -> str:
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def frames_of(video: Path, w: int, h: int):
    p = subprocess.Popen([ffmpeg(), "-loglevel", "error", "-i", str(video), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    n = w * h * 3
    while True:
        b = p.stdout.read(n)
        if len(b) < n:
            break
        yield np.frombuffer(b, np.uint8).reshape(h, w, 3)
    p.wait()


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("folder", type=Path)
    ap.add_argument("--frames", type=Path, required=True)
    ap.add_argument("--overlay", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--width", type=int, default=1920)
    ap.add_argument("--height", type=int, default=1080)
    ap.add_argument("--crf", type=int, default=18)
    a = ap.parse_args(argv)
    film = json.loads((a.folder / "film.json").read_text(encoding="utf-8"))
    cap = json.loads((a.folder / "capture.json").read_text(encoding="utf-8"))
    fps, sweep, W, H = cap["fps"], film["sweep_seconds"], a.width, a.height
    total = int(round(film["duration"] * fps))
    cards = [((s["sweeps"][0] - 1) * sweep, s["sweeps"][1] * sweep) for s in film["segments"] if s.get("lines") or s.get("speaker") == "UI"]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.hypot((xx / W - 0.5) * 1.6, (yy / H - 0.5) * 1.6)
    vignette = (1 - 0.55 * np.clip(r - 0.35, 0, 1) ** 1.5)[..., None]
    plate = (np.clip(1 - np.hypot(xx / (W * 0.62), yy / (H * 0.55)), 0, 1) ** 0.8)[..., None]
    enc = subprocess.Popen([ffmpeg(), "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(fps), "-i", "-",
                            "-c:v", "libx264", "-preset", "slow", "-crf", str(a.crf), "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(a.out)], stdin=subprocess.PIPE)
    over = frames_of(a.overlay, W, H)
    for i in range(total):
        t = i / fps
        layer = next(over).astype(np.float32)
        shot = next((s for s in cap["shots"] if (s["sweeps"][0] - 1) * sweep <= t < s["sweeps"][1] * sweep), None)
        if shot is None:
            out = layer
        else:
            t0, t1 = (shot["sweeps"][0] - 1) * sweep, shot["sweeps"][1] * sweep
            k = int(round((t - t0) * fps))
            im = Image.open(a.frames / f"s{shot['sweeps'][0]:02d}" / f"frame-{k:05d}.ppm").convert("RGB")
            z = shot["push"][0] + (shot["push"][1] - shot["push"][0]) * smooth((t - t0) / (t1 - t0))
            cw, ch = im.width / z, im.height / z
            fx, fy = shot.get("focus", [0.5, 0.5])
            x0, y0 = fx * im.width - cw / 2, fy * im.height - ch / 2
            if not shot.get("pad"):   # "pad": the crop may pass the frame's edge, filled with black, to centre its focus
                x0 = min(max(x0, 0), im.width - cw); y0 = min(max(y0, 0), im.height - ch)
            im = im.crop((x0, y0, x0 + cw, y0 + ch)).resize((W, H), Image.LANCZOS)
            base = np.asarray(im, np.float32) * vignette
            shade = max((window(t, c0 + 0.1, c1, 0.6, 0.4) for c0, c1 in cards), default=0.0)
            base = base * (1 - 0.78 * shade * plate)
            cov = np.clip(layer.max(axis=2, keepdims=True) / 236.0, 0, 1)
            out = base * (1 - cov) + layer
        enc.stdin.write(np.clip(out + 0.5, 0, 255).astype(np.uint8).tobytes())
    enc.stdin.close()
    enc.wait()
    print(f"{total} frames -> {a.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

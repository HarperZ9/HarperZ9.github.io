"""A quiet generated score for a Motion film, timed to its narration.

    python -m tools.explainer.film.score media/explainers/checking-cost OUT.wav [--seconds 177.47]

Pads change chord at each segment start in timing.json; soft bells mark the
moments listed in the film folder's score.json ("bells": [seconds, ...],
"swells": [[start, end], ...]). Deterministic: the same inputs give the same
bytes. 48 kHz stereo, 16-bit. Creative media: it carries no claim.
"""

from __future__ import annotations

import argparse
import json
import wave
from pathlib import Path

import numpy as np

SR = 48000
# One chord per segment (semitones above D2), calm and unresolved until the close.
CHORDS = [[0, 7, 12, 17], [0, 7, 12, 15], [-4, 3, 8, 12], [3, 10, 15, 19], [-2, 5, 10, 14], [-7, 0, 5, 9], [0, 7, 12, 16]]
D2 = 73.416


def hz(semi: float) -> float:
    return D2 * 2 ** (semi / 12)


def pad(t: np.ndarray, chord: list[int], seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    out = np.zeros((len(t), 2))
    for k, s in enumerate(chord):
        f = hz(s)
        for side in (0, 1):
            det = 1 + (rng.random() - 0.5) * 0.004
            ph = rng.random() * 2 * np.pi
            lfo = 1 + 0.25 * np.sin(2 * np.pi * (0.05 + 0.03 * k) * t + ph)
            out[:, side] += (np.sin(2 * np.pi * f * det * t + ph) + 0.25 * np.sin(4 * np.pi * f * det * t)) * lfo / (1 + k * 0.6)
    return out


def bell(freq: float, dur: float = 4.0) -> np.ndarray:
    s = np.arange(int(dur * SR)) / SR
    sig = sum(a * np.sin(2 * np.pi * freq * p * s) * np.exp(-s / (dur * d)) for p, a, d in ((1, 1.0, 0.35), (2.76, 0.4, 0.18), (5.4, 0.2, 0.08)))
    return sig * np.clip(s / 0.004, 0, 1)


def swell(n: int, seed: int) -> np.ndarray:
    """Band-limited noise that rises and falls: the sound of the camera moving through scale."""
    rng = np.random.default_rng(seed)
    x = rng.standard_normal((n, 2))
    spec = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(n, 1 / SR)[:, None]
    spec *= np.exp(-((np.log(np.maximum(f, 1)) - np.log(400)) ** 2) / 1.2)
    y = np.fft.irfft(spec, n=n, axis=0)
    e = np.sin(np.linspace(0, np.pi, n)) ** 2
    return y / (np.abs(y).max() + 1e-9) * e[:, None]


def build(folder: Path, seconds: float) -> np.ndarray:
    timing = json.loads((folder / "timing.json").read_text(encoding="utf-8"))
    marks = json.loads((folder / "score.json").read_text(encoding="utf-8")) if (folder / "score.json").is_file() else {}
    n = int(seconds * SR)
    t = np.arange(n) / SR
    starts = {}
    for r in timing:
        starts.setdefault(r["segment"], r["start"])
    bounds = [0.0] + [starts[k] - 0.8 for k in sorted(starts) if k > 0] + [seconds]
    out = np.zeros((n, 2))
    for k in range(len(bounds) - 1):
        a, b = bounds[k], bounds[k + 1]
        env = np.clip((t - a + 1.5) / 3.0, 0, 1) * np.clip((b + 1.5 - t) / 3.0, 0, 1)
        sel = env > 0
        out[sel] += pad(t[sel], CHORDS[k % len(CHORDS)], 100 + k) * env[sel, None]
    out *= 0.08
    for i, at in enumerate(marks.get("bells", [])):
        sig = bell(hz(CHORDS[0][i % 4] + 24 + (i % 3) * 5)) * 0.06
        j = int(at * SR)
        m = min(n, j + len(sig)) - j
        if m > 0:
            out[j:j + m, 0] += sig[:m] * (0.8 if i % 2 else 1.0)
            out[j:j + m, 1] += sig[:m] * (1.0 if i % 2 else 0.8)
    for a, b in marks.get("swells", []):
        j, m = int(a * SR), int((b - a) * SR)
        out[j:j + m] += swell(m, int(a * 1000)) * 0.05
    # Fade in and out; keep the peak well under full scale.
    out *= np.clip(t / 2.0, 0, 1)[:, None] * np.clip((seconds - t) / 3.0, 0, 1)[:, None]
    return out / max(1e-9, np.abs(out).max()) * 0.5


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("folder", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--seconds", type=float, default=None)
    a = ap.parse_args()
    seconds = a.seconds or json.loads((a.folder / "film.receipt.json").read_text(encoding="utf-8"))["seconds"]
    y = build(a.folder, seconds)
    pcm = (np.clip(y, -1, 1) * 32767).astype("<i2")
    with wave.open(str(a.out), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(a.out, f"{seconds:.2f} s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

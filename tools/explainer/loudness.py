"""Bring the joined narration to the speech target, with a sample-peak ceiling.

The target is the contract's speech class: -16 LUFS integrated (superstack-bs1770/1) within 1 LU.
A plain gain to -16 LUFS would push the Zira narrations' sample peaks above full scale, so a
lookahead peak limiter holds every sample, and the 4x interpolated points beside it, at or under
CEILING_DBFS. CEILING_DBFS sits 0.5 dB under the contract's -1.5 dBTP limit as stated headroom.
The contract meter reads sample peak, a lower bound on true peak, so its pass is necessary, not
sufficient. The interpolated points are this module's estimate, not a true-peak meter: with
sample peaks alone held at -2.0 dBFS, ffmpeg's ebur128 read up to -0.8 dBTP on two narrations;
with the interpolated points held too, it read -1.9 to -2.0 dBTP on all three.

The limiter's gain at a sample is a box average (half-width LOOKAHEAD) of a running minimum
(half-width 2 * LOOKAHEAD) of the gain each sample needs, so the gain applied never exceeds what
any sample in reach needs, and it moves smoothly. The make-up gain is refined from the meter's
own reading a fixed number of times. Every step is float64 numpy in index order, then round half
to even into s16, so the same input PCM gives the same output bytes.
"""

from __future__ import annotations

import numpy as np

from tools import superstack as ss

TARGET_LUFS = ss.LOUDNESS_TARGETS["speech"]["integrated_lufs"]
CEILING_DBFS = -2.0
LOOKAHEAD_S = 0.02
PASSES = 8
FULL_SCALE = 32767.0  # the contract's s16_to_floats divides by 32767


def _running_min(values: np.ndarray, half: int) -> np.ndarray:
    padded = np.pad(values, half, mode="edge")
    return np.lib.stride_tricks.sliding_window_view(padded, 2 * half + 1).min(axis=1)


def _box_mean(values: np.ndarray, half: int) -> np.ndarray:
    padded = np.pad(values, half, mode="edge")
    sums = np.concatenate(([0.0], np.cumsum(padded)))
    width = 2 * half + 1
    return (sums[width:] - sums[:-width]) / width


OVERSAMPLE, TAPS = 4, 12  # 4x as BS.1770 Annex 2 does; 12 input samples a side per phase


def _phase_filters() -> np.ndarray:
    k = np.arange(-TAPS + 1, TAPS + 1, dtype=np.float64)
    rows = []
    for phase in range(1, OVERSAMPLE):
        t = k - phase / OVERSAMPLE
        window = 0.5 + 0.5 * np.cos(np.pi * t / TAPS)  # Hann over the reach of the filter
        rows.append(np.sinc(t) * window)
    return np.array(rows)


def peak_level(x: np.ndarray) -> np.ndarray:
    """Per sample, the largest magnitude of the sample and of the 4x interpolated points within
    one sample of it: an estimate of the true peak near each sample, not a BS.1770 meter."""
    level = np.abs(x)
    padded = np.pad(x, TAPS)
    for row in _phase_filters():
        # point at n + phase/4 = sum_k x[n + k] * sinc(k - phase/4), k in [-TAPS+1, TAPS]
        between = np.abs(np.correlate(padded, row, mode="valid"))[1:len(x) + 1]
        level = np.maximum(level, between)
        level[1:] = np.maximum(level[1:], between[:-1])
    return level


def limit(x: np.ndarray, ceiling: float, half: int) -> np.ndarray:
    level = peak_level(x)
    need = np.where(level > ceiling, ceiling / np.maximum(level, 1e-300), 1.0)
    gain = _box_mean(_running_min(need, 2 * half), half)
    return x * np.minimum(gain, need)


def to_s16(x: np.ndarray) -> bytes:
    return np.clip(np.rint(x * FULL_SCALE), -32768, 32767).astype("<i2").tobytes()


def measure(pcm: bytes, rate: int) -> tuple[float, float]:
    floats = ss.s16_to_floats(pcm)
    return ss.integrated_lufs(floats, rate, 1), ss.peak_dbfs(floats)


def normalise(pcm: bytes, rate: int) -> tuple[bytes, dict]:
    """Mono s16le in, mono s16le out at the speech target; returns the PCM and what was done."""
    source = np.frombuffer(pcm, dtype="<i2").astype(np.float64) / FULL_SCALE
    before_lufs, before_peak = measure(pcm, rate)
    ceiling = 10.0 ** (CEILING_DBFS / 20.0) - 0.5 / FULL_SCALE  # room for rounding into s16
    half = round(LOOKAHEAD_S * rate)
    gain_db, out, lufs = TARGET_LUFS - before_lufs, pcm, before_lufs
    for _ in range(PASSES):
        out = to_s16(limit(source * 10.0 ** (gain_db / 20.0), ceiling, half))
        lufs, _ = measure(out, rate)
        gain_db += TARGET_LUFS - lufs
    gain_db -= TARGET_LUFS - lufs  # the last pass's gain is the one applied
    after_lufs, after_peak = measure(out, rate)
    r2 = lambda v: round(v, 2)
    return out, {
        "rule": "explainer-speech-normalise/1", "meter": ss.METER, "target_lufs": TARGET_LUFS,
        "before_lufs": r2(before_lufs), "before_peak_dbfs": r2(before_peak),
        "gain_db": r2(gain_db), "limiter": {"ceiling_dbfs": CEILING_DBFS, "lookahead_s": LOOKAHEAD_S, "oversample": OVERSAMPLE},
        "after_lufs": r2(after_lufs), "after_peak_dbfs": r2(after_peak),
        "sample_peak_headroom_db": r2(ss.LOUDNESS_TARGETS["speech"]["true_peak_dbtp_max"] - after_peak),
    }

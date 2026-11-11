"""The route backend's input: one chosen take per sentence, read and checked again before it joins a film.

The author's narrator renders several takes per sentence on several local engines fine-tuned on his voice and
picks one per sentence (the renderer is private: it holds the voice models). It hands over <tag>.wav (16, 24 or
32-bit PCM) and <tag>.json (at least "engine"; "seed" when known), where tag is narrate.tag_of() of the sentence.
route_take() returns a function with narrate.take()'s signature that reads that take, trims it, and transcribes it
with narrate's ASR rule, so a take the gate would refuse is flagged in timing.json the same way.
"""

from __future__ import annotations

import hashlib
import json
import wave
from pathlib import Path

import numpy as np


def read_pcm(path: Path) -> tuple[np.ndarray, int]:
    """A 16, 24 or 32-bit integer PCM WAV (first channel) as float64 in [-1, 1]."""
    with wave.open(str(path), "rb") as w:
        sr, ch, width, n = w.getframerate(), w.getnchannels(), w.getsampwidth(), w.getnframes()
        raw = w.readframes(n)
    if width == 3:
        b = np.frombuffer(raw, np.uint8).reshape(-1, 3).astype(np.int32)
        v = b[:, 0] | (b[:, 1] << 8) | (b[:, 2] << 16)
        x = np.where(v >= 1 << 23, v - (1 << 24), v) / float(1 << 23)
    elif width in (2, 4):
        x = np.frombuffer(raw, "<i2" if width == 2 else "<i4") / float(1 << (8 * width - 1))
    else:
        raise ValueError(f"{path.name}: {8 * width}-bit PCM is not supported")
    return np.asarray(x, dtype=np.float64).reshape(-1, ch)[:, 0], sr


def take_tag(tag: str) -> str:
    """The sentence tag inside the seed tag speak() passes ('slug/1/0/2' or 'slug/1.0.2' -> '1.0.2')."""
    return tag.split("/", 1)[1].replace("/", ".")


def route_take(folder: Path):
    """A take() that reads the chosen take for each sentence from folder and checks it with this file's ASR rule."""
    def take(model, asr, text: str, tag: str):
        from tools.explainer.film.narrate import ratio, resample, trim
        name = take_tag(tag)
        wav, meta = folder / f"{name}.wav", folder / f"{name}.json"
        if not wav.is_file():
            raise FileNotFoundError(f"no chosen take for sentence {name} in {folder}")
        info = json.loads(meta.read_text(encoding="utf-8")) if meta.is_file() else {}
        x, sr = read_pcm(wav)
        x = trim(x, sr)
        segs, _ = asr.transcribe(x.astype(np.float32) if sr == 16000 else resample(x, sr, 16000), language="en",
                                 beam_size=5, vad_filter=False)
        heard = " ".join(s.text.strip() for s in segs)
        secs = len(x) / sr
        row = {"seed": info.get("seed"), "try": 1, "asr": heard, "ratio": round(ratio(text, heard), 4),
               "seconds": round(secs, 3), "pace_ok": 0.17 <= secs / max(1, len(text.split())) <= 0.75,
               "engine": info.get("engine", "unknown"), "take_sha256": hashlib.sha256(wav.read_bytes()).hexdigest()}
        print(f"  {row['engine']} ratio {row['ratio']:.3f} {secs:.1f}s  {heard[:70]}", flush=True)
        return x, row, sr
    return take


def describe_route(rows: list[dict], processing: dict, asr_name: str) -> dict:
    """narration.json for a route film: which engines spoke how many sentences, the ASR check, loudness."""
    from tools.explainer.film.narrate import ACCEPT, RATE_OUT
    engines: dict = {}
    for r in rows:
        engines[r.get("engine", "unknown")] = engines.get(r.get("engine", "unknown"), 0) + 1
    return {"backend": "route-local", "hosted": False, "engines": engines,
            "model": "the author's fine-tuned local voice models, one chosen take per sentence",
            "label": "A synthesized version of the author's voice, from models fine-tuned on his recordings with his approval.",
            "asr_check": {"engine": "faster-whisper", "model": asr_name, "device": "cpu int8", "accept_ratio": ACCEPT,
                          "sentences": len(rows), "flagged": sum(not r["accepted"] for r in rows),
                          "mean_ratio": round(float(np.mean([r["ratio"] for r in rows])), 4)},
            "loudness": processing, "rate": RATE_OUT, "reproducible": False}

"""Long-form narration in the author's synthesized voice: sentence by sentence, checked by ASR.

    python -m tools.explainer.film.narrate media/explainers/checking-cost OUT_DIR --model DIR

Runs on a GPU (bfloat16) or the CPU (float32) with qwen-tts 0.1.1 and the author's fine-tuned Qwen3-TTS checkpoint (private, never
in this repository). Each sentence is generated alone with a seed derived from its place in the
film, trimmed of edge silence, levelled, and transcribed by faster-whisper on the CPU. A take is
kept when its transcript matches the script (ratio at or above ACCEPT); otherwise it is redone with
the next seed, up to TRIES times, and the closest take is kept and flagged. Takes are joined with
fixed pauses and the join is brought to -16 LUFS by tools/explainer/loudness.py. Writes
narration.wav, timing.json (one row per sentence) and narration.json (how it was made).
"""

from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import re
import sys
import wave
from pathlib import Path

import numpy as np

ACCEPT, TRIES = 0.92, 5
HEAD, GAP_SENTENCE, GAP_LINE, GAP_SEGMENT = 0.6, 0.32, 0.6, 1.2
SETTINGS = {"dtype": "bfloat16", "attn_implementation": "sdpa", "do_sample": True, "temperature": 0.9, "top_k": 50,
            "top_p": 1.0, "repetition_penalty": 1.05, "subtalker_temperature": 0.9, "subtalker_top_k": 50,
            "language": "Auto", "speaker": "author", "mode": "custom_voice"}
ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen " \
       "seventeen eighteen nineteen".split()
CONTRACTIONS = {"here's": "here is", "it's": "it is", "that's": "that is", "what's": "what is",
                "there's": "there is", "you've": "you have", "i've": "i have", "don't": "do not",
                "doesn't": "does not", "didn't": "did not", "can't": "cannot", "isn't": "is not",
                "won't": "will not", "i'm": "i am", "they're": "they are", "we're": "we are"}
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()


def words(n: int) -> str:
    if n < 20:
        return ONES[n]
    if n < 100:
        return TENS[n // 10] + ("" if n % 10 == 0 else " " + ONES[n % 10])
    if n < 1000:
        return ONES[n // 100] + " hundred" + ("" if n % 100 == 0 else " " + words(n % 100))
    for size, name in ((10 ** 9, "billion"), (10 ** 6, "million"), (1000, "thousand")):
        if n >= size:
            rest = n % size
            return words(n // size) + " " + name + ("" if rest == 0 else " " + words(rest))
    return str(n)


def norm(text: str) -> list[str]:
    """Lowercase words with digits spelled out, so '84' and 'eighty-four' compare equal."""
    t = text.lower().replace("\u2019", "'").replace("%", " percent").replace("-", " ")
    for short, full in CONTRACTIONS.items():
        t = re.sub(r"\b" + re.escape(short) + r"\b", full, t)
    t = re.sub(r"(\d),(\d)", r"\1\2", t)
    teens = ONES[11:20]  # "fifteen hundred" and "1500" must compare equal
    t = re.sub(r"\b(" + "|".join(teens) + r") hundred\b", lambda m: str((teens.index(m.group(1)) + 11) * 100), t)
    t = re.sub(r"(\d+)\.(\d+)", lambda m: f"{m.group(1)} point {' '.join(m.group(2))}", t)
    t = re.sub(r"\d+", lambda m: " " + words(int(m.group())) + " ", t)
    t = t.replace(" and ", " ").replace(" a hundred", " one hundred")
    return re.findall(r"[a-z']+", t)


def ratio(script: str, heard: str) -> float:
    return difflib.SequenceMatcher(a=norm(script), b=norm(heard), autojunk=False).ratio()


def sentences(line: str) -> list[str]:
    return [s for s in re.split(r"(?<=[.!?])\s+(?=[A-Z0-9])", line.strip()) if s]


def seed_of(tag: str) -> int:
    return int.from_bytes(hashlib.sha256(tag.encode()).digest()[:4], "big")


def trim(x: np.ndarray, sr: int, floor_db: float = -42.0) -> np.ndarray:
    win = int(0.02 * sr)
    n = len(x) // win
    if n == 0:
        return x
    rms = np.sqrt(np.mean(x[: n * win].reshape(n, win) ** 2, axis=1) + 1e-12)
    loud = np.where(20 * np.log10(rms / (rms.max() + 1e-12)) > floor_db)[0]
    if not len(loud):
        return x
    a, b = max(0, loud[0] * win - int(0.04 * sr)), min(len(x), (loud[-1] + 1) * win + int(0.08 * sr))
    return x[a:b]


def level(x: np.ndarray, sr: int, target_db: float = -20.0) -> np.ndarray:
    """Match the RMS of the voiced 20 ms windows to target_db, so sentences sit at one level."""
    win = int(0.02 * sr)
    n = len(x) // win
    rms = np.sqrt(np.mean(x[: n * win].reshape(n, win) ** 2, axis=1) + 1e-12)
    voiced = rms[rms > rms.max() * 0.1]
    gain = 10 ** (target_db / 20) / (np.sqrt(np.mean(voiced ** 2)) + 1e-12)
    return np.clip(x * gain, -1.0, 1.0)


def take(model, asr, text: str, tag: str):
    import torch
    best = None
    for k in range(TRIES):
        seed = seed_of(f"{tag}/{k}")
        torch.manual_seed(seed)
        gen = {key: SETTINGS[key] for key in ("do_sample", "temperature", "top_k", "top_p", "repetition_penalty",
                                              "subtalker_temperature", "subtalker_top_k")}
        wavs, sr = model.generate_custom_voice(text=text, speaker=SETTINGS["speaker"], language=SETTINGS["language"],
                                               max_new_tokens=min(2048, 15 * len(text.split()) + 60), **gen)
        x = trim(np.asarray(wavs[0], dtype=np.float64), sr)
        secs, n_words = len(x) / sr, len(text.split())
        segs, _ = asr.transcribe(x.astype(np.float32) if sr == 16000 else resample(x, sr, 16000), language="en",
                                 beam_size=5, vad_filter=False)
        heard = " ".join(s.text.strip() for s in segs)
        r = ratio(text, heard)
        pace_ok = 0.17 <= secs / n_words <= 0.75
        row = {"seed": seed, "try": k + 1, "asr": heard, "ratio": round(r, 4), "seconds": round(secs, 3), "pace_ok": pace_ok}
        if best is None or (pace_ok, r) > (best[1]["pace_ok"], best[1]["ratio"]):
            best = (x, row, sr)
        print(f"  try {k + 1} ratio {r:.3f} {secs:.1f}s  {heard[:70]}", flush=True)
        if r >= ACCEPT and pace_ok:
            break
    return best


RATE_OUT = 48000


def to_rate(x: np.ndarray, sr: int, to: int) -> np.ndarray:
    """Band-limited resampling (torchaudio's windowed sinc) for the final narration."""
    import torch
    import torchaudio.functional as AF
    return AF.resample(torch.from_numpy(x.astype(np.float32)), sr, to).numpy().astype(np.float64)


def cached_take(folder: Path, name: str, text: str, make):
    """Reuse a kept take from an earlier run when its text is unchanged, so a crash costs no takes."""
    import soundfile as sf
    folder.mkdir(parents=True, exist_ok=True)
    wav, meta = folder / f"{name}.wav", folder / f"{name}.json"
    if wav.is_file() and meta.is_file():
        row = json.loads(meta.read_text(encoding="utf-8"))
        if row.pop("text") == text:
            x, sr = sf.read(str(wav), dtype="float64")
            print("  cached take", flush=True)
            return x, row, sr
    x, row, sr = make()
    sf.write(str(wav), x, sr, subtype="FLOAT")
    meta.write_text(json.dumps({**row, "text": text}), encoding="utf-8")
    return x, row, sr


def resample(x: np.ndarray, sr: int, to: int) -> np.ndarray:
    n = int(round(len(x) * to / sr))
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x).astype(np.float32)


def rescore(out: Path) -> dict:
    """Recompute each sentence's ratio from its stored transcript with the current norm()."""
    rows = json.loads((out / "timing.json").read_text(encoding="utf-8"))
    for r in rows:
        r["ratio"] = round(ratio(r["text"], r["asr"]), 4)
        r["accepted"] = r["ratio"] >= ACCEPT and r["pace_ok"]
    (out / "timing.json").write_text(json.dumps(rows, indent=1) + "\n", encoding="utf-8", newline="\n")
    info = json.loads((out / "narration.json").read_text(encoding="utf-8"))
    info["asr_check"].update(flagged=sum(not r["accepted"] for r in rows),
                             mean_ratio=round(float(np.mean([r["ratio"] for r in rows])), 4))
    (out / "narration.json").write_text(json.dumps(info, indent=2) + "\n", encoding="utf-8", newline="\n")
    return info["asr_check"]


def snapshot(model_dir: Path) -> str:
    h = hashlib.sha256()
    with open(model_dir / "model.safetensors", "rb") as fh:
        for block in iter(lambda: fh.read(1 << 24), b""):
            h.update(block)
    return h.hexdigest()


def load_models(model_dir: Path, asr_name: str, device: str):
    import torch
    from faster_whisper import WhisperModel
    from qwen_tts import Qwen3TTSModel
    cpu = device == "cpu"
    SETTINGS["dtype"] = "float32" if cpu else "bfloat16"
    SETTINGS["device"] = "cpu" if cpu else "cuda"
    model = Qwen3TTSModel.from_pretrained(str(model_dir), device_map=device, dtype=torch.float32 if cpu else torch.bfloat16,
                                          attn_implementation=SETTINGS["attn_implementation"])
    return model, WhisperModel(asr_name, device="cpu", compute_type="int8")


def speak(film: dict, model, asr, out: Path):
    """Every sentence in order, with the pauses between them; returns the parts, timing rows and rate."""
    parts, rows, t, sr = [], [], HEAD, None
    for i, seg in enumerate(film["segments"]):
        for j, line in enumerate(seg["lines"]):
            said = sentences(line)
            for k, text in enumerate(said):
                print(f"[{i}.{j}.{k}] {text}", flush=True)
                x, row, sr = cached_take(out / "takes", f"{i}.{j}.{k}", text,
                                         lambda: take(model, asr, text, f"{film['slug']}/{i}/{j}/{k}"))
                x = level(x, sr)
                if not parts:
                    parts.append(np.zeros(int(HEAD * sr)))
                parts.append(x)
                rows.append({"segment": i, "line": j, "sentence": k, "start": round(t, 3),
                             "end": round(t + len(x) / sr, 3), "text": text, **row,
                             "accepted": row["ratio"] >= ACCEPT and row["pace_ok"]})
                t += len(x) / sr
                last_l = j == len(seg["lines"]) - 1
                gap = GAP_SENTENCE if k < len(said) - 1 else GAP_SEGMENT if last_l else GAP_LINE
                parts.append(np.zeros(int(gap * sr)))
                t += int(gap * sr) / sr
    return parts, rows, sr


def write_wav(path: Path, parts: list, sr: int) -> dict:
    from tools.explainer import loudness
    joined = to_rate(np.concatenate(parts), sr, RATE_OUT)  # the loudness meter takes 48 kHz, not 24
    pcm = (joined * 32767.0).round().clip(-32768, 32767).astype("<i2").tobytes()
    pcm, processing = loudness.normalise(pcm, RATE_OUT)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE_OUT)
        w.writeframes(pcm)
    return processing


def describe(rows: list[dict], processing: dict, model_dir: Path, asr_name: str) -> dict:
    sampling = ("CPU float32 sampling" if SETTINGS["device"] == "cpu" else "GPU sampling")
    return {"backend": "qwen3-tts-local", "hosted": False, "model": "Qwen3-TTS-12Hz-1.7B-Base + the author's fine-tune",
            "fine_tune_sha256": snapshot(model_dir), "package": "qwen-tts 0.1.1", "settings": SETTINGS,
            "label": "A synthesized version of the author's voice, from a model fine-tuned on his recordings with his approval.",
            "asr_check": {"engine": "faster-whisper", "model": asr_name, "device": "cpu int8", "accept_ratio": ACCEPT,
                          "tries": TRIES, "sentences": len(rows), "flagged": sum(not r["accepted"] for r in rows),
                          "mean_ratio": round(float(np.mean([r["ratio"] for r in rows])), 4)},
            "loudness": processing, "rate": RATE_OUT, "reproducible": False,
            "does_not_prove": ["An ASR match shows the words were spoken as written; it does not show they sound natural.",
                               f"Seeds are recorded, but {sampling} was not checked for bit-exact reruns, so a rerun may differ."]}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("folder", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--model", type=Path, required=True)
    ap.add_argument("--asr", default="medium.en")
    ap.add_argument("--device", default="cuda:0", help="cuda:0 (bfloat16) or cpu (float32)")
    a = ap.parse_args()
    film = json.loads((a.folder / "film.json").read_text(encoding="utf-8"))
    a.out.mkdir(parents=True, exist_ok=True)
    model, asr = load_models(a.model, a.asr, a.device)
    parts, rows, sr = speak(film, model, asr, a.out)
    processing = write_wav(a.out / "narration.wav", parts, sr)
    (a.out / "timing.json").write_text(json.dumps(rows, indent=1) + "\n", encoding="utf-8", newline="\n")
    info = describe(rows, processing, a.model, a.asr)
    (a.out / "narration.json").write_text(json.dumps(info, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(info["asr_check"]), processing.get("after_lufs"))
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Narration receipts for the explainers, on the superstack contract (SPEC section 8.7).

    python -m tools.explainer.narration media/explainers/cost-to-verify           # write
    python -m tools.explainer.narration media/explainers/cost-to-verify --check   # verify only

Writing rebuilds the narration with the local voice (Windows only, as render.py does), requires
its WAV to match the `narration_wav_sha256` already in the explainer's receipt, and writes
`narration.receipt.json`: a `superstack.receipt/1` whose content is the narration's s16le PCM,
with the narration block (backend, model, snapshot, voice, script hash, reference false,
reproducible), the loudness measured with the contract's BS.1770 meter against the speech target
(-16 LUFS within 1 LU, peak at or below -1.5 dBTP), and the access rules (no autoplay, VTT
captions, a transcript). --check needs no voice: it verifies the seal, ties the receipt to the
explainer's receipt and spec, and recomputes the script hash. Nothing here changes the
published video; the loudness is measured, not corrected.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import tempfile
import wave
from pathlib import Path

from tools import superstack as ss

ROOT = Path(__file__).resolve().parents[2]
NAME = "narration.receipt.json"


def script_of(spec: dict) -> list[str]:
    """Every line the voice speaks, in order, exactly as sent."""
    from tools.explainer import scene as frames
    return [s["say"] for s in frames.resolved_scenes(spec)]


def text_sha256(lines: list[str]) -> str:
    # Each line is one call to the voice; the hash covers the lines joined by LF, unnormalised.
    return hashlib.sha256("\n".join(lines).encode("utf-8")).hexdigest()


def pcm_of(wav_path: Path) -> tuple[bytes, int, int]:
    with wave.open(str(wav_path)) as w:
        assert w.getsampwidth() == 2, "narration must be 16-bit"
        return w.readframes(w.getnframes()), w.getframerate(), w.getnchannels()


def build(folder: Path) -> dict:
    from tools.explainer import draw, voice
    from tools.explainer import scene as frames
    spec_path = folder / "spec.json"
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    receipt = json.loads((folder / "receipt.json").read_text(encoding="utf-8"))
    with tempfile.TemporaryDirectory() as tmp:
        _, wav = voice.narrate(frames.resolved_scenes(spec), Path(tmp), draw.FPS)
        wav_sha = hashlib.sha256(wav.read_bytes()).hexdigest()
        if wav_sha != receipt["narration_wav_sha256"]:
            raise SystemExit(f"{folder.name}: the rebuilt narration DRIFTs from the published one; no receipt written")
        pcm, rate, channels = pcm_of(wav)
    lines = script_of(spec)
    floats = ss.s16_to_floats(pcm)
    lufs, peak = ss.integrated_lufs(floats, rate, channels), ss.peak_dbfs(floats)
    frames_n = len(pcm) // 2 // channels
    scene = {"kind": "superstack.sound/1", "producer": "explainer-narration", "slug": spec["slug"],
             "spec_sha256": receipt["spec"]["sha256"], "rate": rate, "channels": channels,
             "duration_samples": frames_n, "lines": lines}
    r2 = lambda v: None if v is None else round(v, 2)
    media = {"kind": "audio", "content": "speech", "rate": rate, "channels": channels, "format": "s16le",
             "frames": frames_n, "duration_flicks": frames_n * ss.flicks_per_sample(rate),
             "meter": ss.METER, "integrated_lufs": r2(lufs), "peak_dbfs": r2(peak),
             "loudness_class": "speech", "loudness_verdict": ss.loudness_check("speech", lufs, peak),
             "loudness_target": ss.LOUDNESS_TARGETS["speech"],
             "access": {"autoplay": False, "captions": "vtt", "transcript": True, "reduced_sound": "silent"},
             "narration": {"backend": "windows-sapi", "hosted": False, "model": "System.Speech (SAPI 5)",
                           "snapshot": receipt["toolchain"]["os"], "voice": receipt["toolchain"]["voice"],
                           "text_sha256": text_sha256(lines), "reference": False, "reproducible": True}}
    slug = spec["slug"]
    rec = ss.make_receipt(
        producer="harperz9-explainer-narration", version="1.0.0", backend="windows-sapi", scene=scene, media=media,
        content=pcm, outputs={"narration.wav": receipt["narration_wav_sha256"], f"{slug}.mp4": receipt["outputs"][f"{slug}.mp4"]},
        does_not_prove=[
            "A PCM hash covers samples, not speakers: it says nothing about how a device plays them.",
            "The published video carries this narration as 96 kb/s AAC; decoding it does not return these samples.",
            "reproducible means a rebuild on Windows with the same voice and OS build gave the same PCM (checked "
            "on the date of this receipt); another machine or voice update need not.",
            "The loudness is one meter's reading (superstack-bs1770/1) of the narration alone, and the peak is the "
            "sample peak, not true peak. The narration was measured, not corrected to the target.",
            "Neither hash shows that the narration is correct, clear, or well paced.",
        ])
    # The scene travels inside the sealed receipt, so --check can rehash it without the voice.
    return ss.seal({**rec, "scene": scene})


def check(folder: Path) -> list[str]:
    path = folder / NAME
    if not path.is_file():
        return [f"{NAME} is missing"]
    rec = json.loads(path.read_text(encoding="utf-8"))
    problems = [f"receipt: {e}" for e in ss.verify_receipt(rec)]
    receipt = json.loads((folder / "receipt.json").read_text(encoding="utf-8"))
    spec = json.loads((folder / "spec.json").read_text(encoding="utf-8"))
    scene = rec.get("scene") or {}
    if rec["outputs"].get("narration.wav") != receipt["narration_wav_sha256"]:
        problems.append("the narration receipt names a different narration WAV than the explainer receipt")
    if ss.canonical_sha256(scene) != rec["scene_sha256"]:
        problems.append("the scene does not hash to scene_sha256")
    if scene.get("spec_sha256") != receipt["spec"]["sha256"]:
        problems.append("the narration receipt names a different spec")
    if rec["media"]["narration"]["text_sha256"] != text_sha256(script_of(spec)):
        problems.append("the script changed since the narration receipt")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("folder", type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    folder = args.folder.resolve()
    if args.check:
        problems = check(folder)
        print("\n".join(problems) or "narration receipt matches")
        return 1 if problems else 0
    rec = build(folder)
    (folder / NAME).write_text(json.dumps(rec, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    m = rec["media"]
    print(folder.name, rec["content_sha256"][:16], m["integrated_lufs"], "LUFS", m["peak_dbfs"], "dBFS", m["loudness_verdict"])
    return 0


if __name__ == "__main__":
    sys.exit(main())

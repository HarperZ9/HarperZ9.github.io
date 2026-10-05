"""Render a film: plate (GPU) + evidence marks (Pillow) + the author-voice narration -> MP4.

    python -m tools.explainer.film.render media/explainers/checking-cost --narration DIR   # build (GPU)
    python -m tools.explainer.film.render media/explainers/checking-cost --preview          # CPU sheet
    python -m tools.explainer.film.render media/explainers/checking-cost --check            # hashes

DIR holds narration.wav and timing.json from narrate.py. The narration is sampled on a GPU, so
it does not rebuild bit for bit; the receipt records its hash and says so.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
CODE = ("__init__.py", "timeline.py", "figures.py", "plate.py", "render.py", "narrate.py")
FPS = 30
TAIL = 1.5  # seconds of the last frame held after the narration ends
DOES_NOT_PROVE = ("Matching hashes show these files are the ones this render made from this script, code and "
                  "narration. They do not show that the explanation is correct or that it teaches. The narration "
                  "is a synthesized version of the author's voice, sampled on a GPU, so a rerun does not give the "
                  "same audio bytes.")


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def fake_timing(film: dict) -> list[dict]:
    """Preview timing at 2.6 words a second, for contact sheets before the narration exists."""
    rows, t = [], 0.0
    for i, seg in enumerate(film["segments"]):
        for j, line in enumerate(seg["lines"]):
            d = max(2.0, len(line.split()) / 2.6)
            rows.append({"segment": i, "line": j, "start": round(t, 3), "end": round(t + d, 3), "text": line})
            t += d + 0.5
        t += 0.8
    return rows


def stamp(s: float, sep: str) -> str:
    ms = round(s * 1000)
    return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02}{sep}{ms % 1000:03}"


def cues(timing: list[dict], width: int = 84) -> list[tuple[float, float, str]]:
    """One caption cue per sentence, split at word boundaries into parts of at most two lines."""
    out = []
    for row in timing:
        words, parts, cur = row["text"].split(), [], ""
        for w in words:
            if len(cur) + len(w) + 1 > width and cur:
                parts.append(cur)
                cur = w
            else:
                cur = f"{cur} {w}".strip()
        parts.append(cur)
        chunks = [" ".join(parts[k:k + 1]) for k in range(len(parts))]
        groups = ["\n".join(chunks[k:k + 2]) for k in range(0, len(chunks), 2)]
        span = (row["end"] - row["start"]) / len(groups)
        out += [(row["start"] + k * span, row["start"] + (k + 1) * span, g) for k, g in enumerate(groups)]
    return out


def write_captions(folder: Path, slug: str, timing: list[dict]) -> None:
    cs = cues(timing)
    vtt = "WEBVTT\n\n" + "\n".join(f"{stamp(a, '.')} --> {stamp(b, '.')}\n{t}\n" for a, b, t in cs)
    srt = "\n".join(f"{n}\n{stamp(a, ',')} --> {stamp(b, ',')}\n{t}\n" for n, (a, b, t) in enumerate(cs, 1))
    (folder / f"{slug}.vtt").write_text(vtt, encoding="utf-8", newline="\n")
    (folder / f"{slug}.srt").write_text(srt, encoding="utf-8", newline="\n")


def load(folder: Path):
    film = json.loads((folder / "film.json").read_text(encoding="utf-8"))
    evidence = json.loads((folder / "evidence.json").read_text(encoding="utf-8"))["sources"]
    return film, evidence


def compose(plate_rgb: np.ndarray, overlay) -> np.ndarray:
    ov = np.asarray(overlay, dtype=np.float32)
    a = ov[..., 3:4] / 255.0
    return (plate_rgb.astype(np.float32) * (1 - a) + ov[..., :3] * a + 0.5).astype(np.uint8)


def frames(film, evidence, timing, total, plate=None, times=None):
    from tools.explainer.film import figures, timeline
    from tools.explainer.film.plate import black
    fonts = figures.Fonts()
    spans = timeline.line_spans(film, timing)
    bounds = timeline.segment_bounds(film, spans, total)
    cache: dict = {}
    for t in times if times is not None else (i / FPS for i in range(round(total * FPS))):
        st = timeline.frame_state(film, spans, bounds, t)
        bright = 0.9 if st["segment"].get("layout") == "title" else 0.32
        base = plate.frame(st["scale"], t, bright) if plate else black(figures.W, figures.H)
        # The marks change only while something fades; a settled frame reuses its overlay.
        key = (st["index"], round(st["alpha"], 3), tuple(round(r, 3) for r in st["reveal"]))
        if key not in cache:
            if len(cache) > 64:
                cache.clear()
            ov = np.asarray(figures.overlay(fonts, st, film, evidence), dtype=np.float32)
            cache[key] = (ov[..., :3] * (ov[..., 3:4] / 255.0), 1.0 - ov[..., 3:4] / 255.0)
        pre, keep = cache[key]
        yield t, st, (base.astype(np.float32) * keep + pre + 0.5).astype(np.uint8)


def preview(folder: Path) -> Path:
    from PIL import Image
    film, evidence = load(folder)
    timing = fake_timing(film)
    total = timing[-1]["end"] + TAIL
    spans_end = {}
    for r in timing:
        spans_end[r["segment"]] = r["end"]
    times = [spans_end[i] - 0.05 for i in sorted(spans_end)]
    tiles = [Image.fromarray(f).resize((640, 360)) for _, _, f in frames(film, evidence, timing, total, None, times)]
    sheet = Image.new("RGB", (1280, 360 * ((len(tiles) + 1) // 2)), (20, 20, 24))
    for k, tile in enumerate(tiles):
        sheet.paste(tile, ((k % 2) * 640, (k // 2) * 360))
    out = Path.cwd() / f"{film['slug']}-preview.png"
    sheet.save(out)
    return out


def build(folder: Path, narration: Path, use_plate: bool = True) -> dict:
    import imageio_ffmpeg
    from PIL import Image
    from tools.explainer.film import figures
    from tools.explainer.film.plate import Plate
    film, evidence = load(folder)
    slug = film["slug"]
    timing = json.loads((narration / "timing.json").read_text(encoding="utf-8"))
    wav = narration / "narration.wav"
    with wave.open(str(wav)) as w:
        speech = w.getnframes() / w.getframerate()
    total = round((speech + TAIL) * FPS) / FPS
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    mp4 = folder / f"{slug}.mp4"
    cmd = [ffmpeg, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{figures.W}x{figures.H}",
           "-r", str(FPS), "-i", "-", "-i", str(wav), "-af", "apad", "-c:v", "libx264", "-preset", "slow", "-crf", "20",
           "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-map_metadata", "-1", "-movflags", "+faststart",
           "-shortest", str(mp4)]
    enc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    plate = Plate(figures.W, figures.H, film["seed"]) if use_plate else None
    chain, poster = hashlib.sha256(), None
    poster_at = film.get("poster", {"segment": 2, "u": 0.9})
    try:
        for t, st, frame in frames(film, evidence, timing, total, plate):
            raw = frame.tobytes()
            chain.update(hashlib.sha256(raw).digest())
            enc.stdin.write(raw)
            if poster is None and st["index"] == poster_at["segment"] and st["u"] >= poster_at["u"]:
                poster = Image.fromarray(frame)
    finally:
        enc.stdin.close()
        if plate:
            plate.release()
    if enc.wait() != 0:
        raise RuntimeError(f"{slug}: ffmpeg failed")
    poster.save(folder / "poster.jpg", quality=88)
    write_captions(folder, slug, timing)
    (folder / "timing.json").write_text(json.dumps(timing, indent=1) + "\n", encoding="utf-8", newline="\n")
    outs = [f"{slug}.mp4", f"{slug}.vtt", f"{slug}.srt", "poster.jpg", "timing.json"]
    version = subprocess.run([ffmpeg, "-version"], capture_output=True, text=True).stdout.splitlines()[0]
    nar = json.loads((narration / "narration.json").read_text(encoding="utf-8"))
    return {
        "schema": "explainer-film-receipt/1", "slug": slug, "title": film["title"], "page": film["page"],
        "script": {"path": f"media/explainers/{slug}/film.json", "sha256": sha(folder / "film.json")},
        "evidence": {"path": f"media/explainers/{slug}/evidence.json", "sha256": sha(folder / "evidence.json")},
        "render_code": {f"tools/explainer/film/{n}": sha(HERE / n) for n in CODE},
        "toolchain": {"python": platform.python_version(), "ffmpeg": version, "os": platform.platform(),
                      "plate": "GLSL 330 on moderngl, headless, GPU" if use_plate else "none (ground colour only)"},
        "narration": {"wav_sha256": sha(wav), "seconds": round(speech, 3), **nar},
        "frames": round(total * FPS), "fps": FPS, "seconds": total, "frame_chain_sha256": chain.hexdigest(),
        "outputs": {n: sha(folder / n) for n in outs},
        "does_not_prove": DOES_NOT_PROVE,
    }


def check(folder: Path) -> list[str]:
    rec = json.loads((folder / "film.receipt.json").read_text(encoding="utf-8"))
    problems = []
    for key in ("script", "evidence"):
        if sha(ROOT / rec[key]["path"]) != rec[key]["sha256"]:
            problems.append(f"{rec[key]['path']} changed since the render")
    for path, digest in rec["render_code"].items():
        if sha(ROOT / path) != digest:
            problems.append(f"{path} changed since the render")
    for name, digest in rec["outputs"].items():
        if not (folder / name).is_file() or sha(folder / name) != digest:
            problems.append(f"{name} does not match the receipt")
    return problems


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("folder", type=Path)
    ap.add_argument("--narration", type=Path)
    ap.add_argument("--preview", action="store_true")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--no-plate", action="store_true", help="skip the GPU plate (pipeline test on the CPU)")
    a = ap.parse_args()
    folder = a.folder.resolve()
    if a.check:
        problems = check(folder)
        print("\n".join(problems) or "film receipt matches")
        return 1 if problems else 0
    if a.preview:
        print(preview(folder))
        return 0
    rec = build(folder, a.narration.resolve(), use_plate=not a.no_plate)
    (folder / "film.receipt.json").write_text(json.dumps(rec, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(rec["slug"], rec["seconds"], "s", rec["outputs"][f"{rec['slug']}.mp4"][:16])
    return 0


if __name__ == "__main__":
    sys.exit(main())

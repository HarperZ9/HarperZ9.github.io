"""Build a film from its Motion scene: score, frame-exact render, web encode, receipt.

    python -m tools.explainer.film.motion media/explainers/checking-cost --narration DIR \\
        --raw-native PATH [--master DIR] [--width 3840 --height 2160]

The scene (film.scene.mjs) draws every frame with raw-native's Motion layer
in headless Chrome on WebGPU (PATH/scripts/motion_render.py). The master is
rendered at --width x --height with the narration and the generated score
muxed in; the page gets a 1920 x 1080 H.264 copy, an AAC track for the live
version, and a poster. The captions and timing are the narration's and are
not touched. The receipt lists the hash of the script, sources, scene code,
vendored engine and every output. Needs the GPU; take D:/gpu.lock.d first.
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

ROOT = Path(__file__).resolve().parents[3]
FPS = 30
DOES_NOT_PROVE = ("Matching hashes show these files are the ones this build made from this script, scene code, engine and "
                  "narration. They do not show that the explanation is correct or that it teaches. The pictures are drawn for "
                  "explanation: shapes such as the cascade trees and the order of the dots are illustrations, and only the "
                  "numbers on screen come from the sources. The narration is a synthesized version of the author's voice, sampled "
                  "from a speech model, so a rerun need not give the same audio bytes.")


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def ffmpeg() -> str:
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def engine_dir(scene: Path) -> Path:
    """The vendored raw-native web folder the scene imports from."""
    import re
    m = re.search(r'"\.\./\.\./raw-native/(web-[\w-]+)/motion/', scene.read_text(encoding="utf-8"))
    if not m:
        sys.exit("film.scene.mjs imports no vendored raw-native web folder")
    return ROOT / "media" / "raw-native" / m.group(1)


def code_files(folder: Path) -> list[Path]:
    eng = engine_dir(folder / "film.scene.mjs")
    files = [folder / "film.scene.mjs", *sorted((folder / "scene").glob("*.mjs")), folder / "score.json",
             *sorted((eng / "motion").glob("*")), eng / "raw-gpu.mjs", eng / "frame-graph.mjs", eng / "threads.mjs", eng / "threads.wgsl",
             ROOT / "media" / "explainers" / "motion" / "hanken-500.json", ROOT / "media" / "explainers" / "motion" / "hanken-650.json",
             ROOT / "media" / "explainers" / "motion" / "conso-400.json",
             Path(__file__), Path(__file__).with_name("score.py")]
    return [f for f in files if f.is_file()]


def run(cmd: list[str]) -> None:
    print("+", " ".join(str(c) for c in cmd[:6]), "...", flush=True)
    subprocess.run([str(c) for c in cmd], check=True)


def build(folder: Path, narration: Path, raw_native: Path, master_dir: Path, w: int, h: int, poster_at: float) -> dict:
    from tools.explainer.film import score
    rec_old = json.loads((folder / "film.receipt.json").read_text(encoding="utf-8"))
    film = json.loads((folder / "film.json").read_text(encoding="utf-8"))
    slug = film["slug"]
    seconds = rec_old["frames"] / FPS
    master_dir.mkdir(parents=True, exist_ok=True)
    wav = narration / "narration.wav"
    if sha(wav) != rec_old["narration"]["wav_sha256"]:
        sys.exit("narration.wav is not the narration the captions were made from")
    # 1. The score, then the master render with narration and score muxed.
    y = score.build(folder, seconds)
    score_wav = master_dir / f"{slug}-score.wav"
    import numpy as np
    with wave.open(str(score_wav), "wb") as f:
        f.setnchannels(2); f.setsampwidth(2); f.setframerate(score.SR)
        f.writeframes((np.clip(y, -1, 1) * 32767).astype("<i2").tobytes())
    master = master_dir / f"{slug}-{w}x{h}.mp4"
    page = f"media/raw-native/{engine_dir(folder / 'film.scene.mjs').name}/motion/capture.html"
    scene_rel = "../../../" + str((folder / "film.scene.mjs").relative_to(ROOT / "media")).replace("\\", "/")
    run([sys.executable, raw_native / "scripts" / "motion_render.py", "--root", ROOT, "--page", page, "--scene", scene_rel, "--shaders", "../",
         "--out", master, "--width", w, "--height", h, "--fps", FPS, "--audio", wav, "--score", score_wav, "--score-db", "-13", "--qp", "14"])
    stats = json.loads(Path(str(master) + ".stats.json").read_text(encoding="utf-8"))
    # 2. The page copy: 1920 x 1080 H.264 and AAC, the audio alone, and the poster.
    ff = ffmpeg()
    mp4 = folder / f"{slug}.mp4"
    run([ff, "-y", "-loglevel", "error", "-i", master, "-vf", "scale=1920:1080:flags=lanczos", "-c:v", "libx264", "-preset", "slow",
         "-crf", "21", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-map_metadata", "-1", "-movflags", "+faststart", mp4])
    m4a = folder / f"{slug}.m4a"
    run([ff, "-y", "-loglevel", "error", "-i", mp4, "-vn", "-c:a", "copy", "-map_metadata", "-1", "-movflags", "+faststart", m4a])
    poster = folder / "poster.jpg"
    run([ff, "-y", "-loglevel", "error", "-ss", f"{poster_at:.3f}", "-i", mp4, "-frames:v", "1", "-q:v", "3", poster])
    outputs = {p.name: sha(p) for p in (mp4, folder / f"{slug}.vtt", folder / f"{slug}.srt", poster, folder / "timing.json", m4a)}
    rec = {k: v for k, v in rec_old.items() if k not in ("frame_chain_sha256",)}
    rec["render_code"] = {str(p.relative_to(ROOT)).replace("\\", "/"): sha(p) for p in code_files(folder)}
    rec["toolchain"] = {
        "renderer": "raw-native Motion (web/motion), WebGPU in headless Chrome, frames encoded by WebCodecs H.264",
        "adapter": stats.get("adapter"), "python": platform.python_version(), "os": platform.platform(),
        "ffmpeg": subprocess.run([ff, "-version"], capture_output=True, text=True).stdout.splitlines()[0],
        "master": {"width": w, "height": h, "frames": stats.get("frames"), "frame_ms_median": round(stats.get("frame_ms_median", 0), 2),
                   "frame_ms_p95": round(stats.get("frame_ms_p95", 0), 2), "wall_seconds": stats.get("wall_seconds"), "sha256": sha(master)},
        "score": {"generator": "tools/explainer/film/score.py", "mix_db": -13, "sha256": sha(score_wav)},
    }
    rec["outputs"] = outputs
    rec["does_not_prove"] = DOES_NOT_PROVE
    return rec


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("folder", type=Path)
    ap.add_argument("--narration", type=Path, required=True)
    ap.add_argument("--raw-native", type=Path, required=True)
    ap.add_argument("--master", type=Path, default=Path("masters"))
    ap.add_argument("--width", type=int, default=3840)
    ap.add_argument("--height", type=int, default=2160)
    ap.add_argument("--poster-at", type=float, default=50.0)
    a = ap.parse_args()
    folder = a.folder.resolve()
    rec = build(folder, a.narration.resolve(), a.raw_native.resolve(), a.master.resolve(), a.width, a.height, a.poster_at)
    (folder / "film.receipt.json").write_text(json.dumps(rec, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(rec["slug"], rec["outputs"][f"{rec['slug']}.mp4"][:16], json.dumps(rec["toolchain"]["master"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())

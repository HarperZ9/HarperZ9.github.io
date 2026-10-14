"""Build the web copies of the three guides (Tallow, Pylon, Rerun) into media/guides/.

    python -m tools.guides.build_media --renders DIR --clips DIR [--intro GUIDE=FILE ...]

DIR paths point at a guides render round (stills as <guide>-<world>[-<framing>].png, clips as
<guide>-idle.mp4, <guide>-action.mp4 and <guide>-intro.mp4). For each guide this writes, small
enough for a page:

    still.jpg       the home world, medium framing, 960 x 540
    close.jpg       the home world, close framing, 480 x 480 crop around the face
    sheet.jpg       the turnaround sheet, 1280 wide
    idle.mp4        the idle loop, 640 x 360, no audio
    action.mp4      the signature action, 640 x 360, no audio
    intro.mp4       the introduction, 1280 x 720: silent, or with the audio given by --intro
    intro.jpg       the introduction's poster
    intro.vtt       captions from intro.timing.json (laid out like the films' captions)

and media/guides/guides.json with the SHA-256 of every file. The page links fixed file names,
so an introduction's sound is added or swapped by running this again with --intro GUIDE=FILE
and, if the words or their times changed, a new intro.timing.json; no page code changes. Without
--intro the introduction has no sound track at all, and the page shows it with captions. Only a
guide listed in INTRO_VOICES (tools/guides/data.py, takes the author approved) can be given --intro. The
mouths were animated to a recorded take, so a different take needs the picture re-rendered from it.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "media" / "guides"
GUIDES = {"tallow": "thriller", "pylon": "painted", "rerun": "pixel"}


def ffmpeg() -> str:
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def run(cmd: list) -> None:
    subprocess.run([str(c) for c in cmd], check=True)


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def stamp(s: float) -> str:
    h, rem = divmod(round(s * 1000), 3600_000)
    m, rem = divmod(rem, 60_000)
    return f"{h:02d}:{m:02d}:{rem // 1000:02d}.{rem % 1000:03d}"


def captions(timing: list[dict]) -> str:
    from tools.explainer.film.captions import cues
    return "WEBVTT\n\n" + "\n".join(f"{stamp(a)} --> {stamp(b)}\n{t}\n" for a, b, t in cues(timing))


def stills(g: str, world: str, renders: Path, d: Path) -> None:
    from PIL import Image
    Image.open(renders / f"{g}-{world}-medium.png").convert("RGB").resize((960, 540), Image.LANCZOS).save(d / "still.jpg", quality=82, optimize=True, progressive=True)
    close = Image.open(renders / f"{g}-{world}-close.png").convert("RGB")
    w, h = close.size
    side = h * 0.82
    box = (round(w / 2 - side / 2), round(h * 0.04), round(w / 2 + side / 2), round(h * 0.04 + side))
    close.crop(box).resize((480, 480), Image.LANCZOS).save(d / "close.jpg", quality=82, optimize=True, progressive=True)
    sheet = Image.open(renders / f"{g}-sheet.png").convert("RGB")
    sheet.resize((1280, round(sheet.height * 1280 / sheet.width)), Image.LANCZOS).save(d / "sheet.jpg", quality=80, optimize=True, progressive=True)


def clip(src: Path, dst: Path, w: int, h: int, crf: int, audio: Path | None = None) -> None:
    ff = ffmpeg()
    cmd = [ff, "-y", "-loglevel", "error", "-i", src]
    if audio:
        cmd += ["-i", audio, "-map", "0:v:0", "-map", "1:a:0", "-c:a", "aac", "-b:a", "96k", "-ac", "1"]
    else:
        cmd += ["-an"]
    cmd += ["-vf", f"scale={w}:{h}:flags=lanczos", "-c:v", "libx264", "-preset", "slow", "-crf", str(crf), "-pix_fmt", "yuv420p",
            "-map_metadata", "-1", "-movflags", "+faststart", dst]
    run(cmd)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--renders", type=Path, required=True)
    ap.add_argument("--clips", type=Path, required=True)
    ap.add_argument("--intro", action="append", default=[], help="GUIDE=FILE: audio to put under that guide's introduction")
    a = ap.parse_args()
    audio = dict(x.split("=", 1) for x in a.intro)
    from tools.guides.data import INTRO_VOICES
    unapproved = sorted(set(audio) - set(INTRO_VOICES))
    if unapproved:
        ap.error(f"no approved voice for {', '.join(unapproved)}: add the take to INTRO_VOICES in tools/guides/data.py first")
    manifest = {"schema": "site-guides/1", "guides": {}}
    for g, world in GUIDES.items():
        d = OUT / g
        d.mkdir(parents=True, exist_ok=True)
        stills(g, world, a.renders, d)
        clip(a.clips / f"{g}-idle.mp4", d / "idle.mp4", 640, 360, 30)
        clip(a.clips / f"{g}-action.mp4", d / "action.mp4", 640, 360, 30)
        clip(a.clips / f"{g}-intro.mp4", d / "intro.mp4", 1280, 720, 27, Path(audio[g]) if g in audio else None)
        run([ffmpeg(), "-y", "-loglevel", "error", "-ss", "1.0", "-i", d / "intro.mp4", "-frames:v", "1", "-vf", "scale=960:540", "-q:v", "4", d / "intro.jpg"])
        timing = json.loads((d / "intro.timing.json").read_text(encoding="utf-8"))
        (d / "intro.vtt").write_text(captions(timing), encoding="utf-8", newline="\n")
        files = ["still.jpg", "close.jpg", "sheet.jpg", "idle.mp4", "action.mp4", "intro.mp4", "intro.jpg", "intro.vtt", "intro.timing.json"]
        manifest["guides"][g] = {"world": world, "files": {f: sha(d / f) for f in files},
                                 "bytes": sum((d / f).stat().st_size for f in files),
                                 "intro_audio": g in audio, "intro_voice": INTRO_VOICES[g] if g in audio else None}
    (OUT / "guides.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8", newline="\n")
    for g, m in manifest["guides"].items():
        print(g, m["bytes"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

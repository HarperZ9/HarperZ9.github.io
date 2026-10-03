"""Render one explainer from its spec, write its receipt, or check a receipt against the files.

    python -m tools.explainer.render media/explainers/cost-to-verify            # build
    python -m tools.explainer.render media/explainers/cost-to-verify --verify   # rebuild, compare
    python -m tools.explainer.render media/explainers/cost-to-verify --check    # hashes only

Building needs Windows (the narration voice), Pillow, numpy and imageio-ffmpeg. --check needs
none of them: it confirms that the spec, the render code and every published output still
match the receipt, which is what CI runs.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
RENDER_CODE = ("draw.py", "voice.py", "render.py")
DOES_NOT_PROVE = ("Matching hashes show the same bytes came out of the same spec, code and tools. They do "
                  "not show that the explanation is correct or that it teaches. The narration voice ships "
                  "with Windows, so the audio rebuilds only on a machine with the same voice.")


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rel(path: Path) -> str:
    return path.resolve().relative_to(ROOT).as_posix()


def stamp(seconds: float, sep: str) -> str:
    ms = round(seconds * 1000)
    return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02}{sep}{ms % 1000:03}"


def write_captions(folder: Path, slug: str, timeline) -> None:
    srt = [f"{n}\n{stamp(s, ',')} --> {stamp(e, ',')}\n{scene['say']}\n" for n, (scene, s, e) in enumerate(timeline, 1)]
    (folder / f"{slug}.srt").write_text("\n".join(srt), encoding="utf-8", newline="\n")
    vtt = [f"{stamp(s, '.')} --> {stamp(e, '.')}\n{scene['say']}\n" for scene, s, e in timeline]
    (folder / f"{slug}.vtt").write_text("WEBVTT\n\n" + "\n".join(vtt), encoding="utf-8", newline="\n")


def encode_command(ffmpeg: str, wav: Path, mp4: Path, fps: int, size: str) -> list[str]:
    return [ffmpeg, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", size,
            "-r", str(fps), "-i", "-", "-i", str(wav), "-c:v", "libx264", "-preset", "medium", "-crf", "22",
            "-pix_fmt", "yuv420p", "-threads", "1", "-x264-params", "threads=1:sliced-threads=0",
            "-c:a", "aac", "-b:a", "96k", "-map_metadata", "-1", "-fflags", "+bitexact",
            "-flags:v", "+bitexact", "-flags:a", "+bitexact", "-movflags", "+faststart", "-shortest", str(mp4)]


def build(spec_path: Path, out: Path) -> dict:
    """Draw, narrate and encode one spec into `out`; return the receipt."""
    import imageio_ffmpeg
    import numpy as np
    import PIL
    from PIL import Image

    from tools.explainer import draw, voice

    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    slug, seed = spec["slug"], spec["seed"]
    out.mkdir(parents=True, exist_ok=True)
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    with tempfile.TemporaryDirectory() as tmp:
        timeline, wav = voice.narrate(spec["scenes"], Path(tmp), draw.FPS)
        narration_sha = sha(wav)
        total = round(timeline[-1][2] * draw.FPS)
        painter, chain, poster = draw.Painter(seed), hashlib.sha256(), None
        poster_at = spec.get("poster", {"scene": spec["scenes"][0]["key"], "at": 0.6})
        enc = subprocess.Popen(encode_command(ffmpeg, wav, out / f"{slug}.mp4", draw.FPS, f"{draw.W}x{draw.H}"),
                               stdin=subprocess.PIPE)
        for i in range(total):
            t = i / draw.FPS
            scene, start, end = next(x for x in timeline if x[1] <= t < x[2] + 1e-9)
            u = (t - start) / (end - start)
            img = Image.new("RGBA", (draw.W, draw.H), draw.GROUND)
            draw.draw_scene(painter, scene, u, img)
            if scene.get("layout") != "title":
                draw.caption(painter, img, scene["say"])
            frame = img.convert("RGB")
            if scene.get("layout") in ("title", "close"):
                frame = draw.grain(frame, seed + i)
            if poster is None and scene["key"] == poster_at["scene"] and u >= poster_at["at"]:
                poster = frame
            raw = frame.tobytes()
            chain.update(hashlib.sha256(raw).digest())
            enc.stdin.write(raw)
        enc.stdin.close()
        if enc.wait() != 0:
            raise RuntimeError(f"{slug}: ffmpeg failed; its stderr is above")
    poster.save(out / "poster.png", optimize=False, compress_level=9)
    write_captions(out, slug, timeline)
    version = subprocess.run([ffmpeg, "-version"], capture_output=True, text=True).stdout.splitlines()[0]
    files = [f"{slug}.mp4", f"{slug}.srt", f"{slug}.vtt", "poster.png"]
    return {
        "schema": "explainer-receipt/v1", "slug": slug, "title": spec["title"], "page": spec["page"],
        "spec": {"path": rel(spec_path), "sha256": sha(spec_path)},
        "render_code": {f"tools/explainer/{name}": sha(HERE / name) for name in RENDER_CODE},
        "fonts": {rel(path): sha(path) for path in draw.FONTS.values()},
        "toolchain": {"python": platform.python_version(), "pillow": PIL.__version__, "numpy": np.__version__,
                      "ffmpeg": version, "voice": voice.VOICE, "os": platform.platform()},
        "outputs": {name: sha(out / name) for name in files},
        "narration_wav_sha256": narration_sha, "frames": total, "fps": draw.FPS,
        "seconds": round(total / draw.FPS, 3), "frame_chain_sha256": chain.hexdigest(),
        "timeline": [{"scene": s["key"], "start": round(a, 3), "end": round(b, 3), "text": s["say"]}
                     for s, a, b in timeline],
        "rerun": f"python -m tools.explainer.render {rel(spec_path.parent)} --verify",
        "does_not_prove": DOES_NOT_PROVE,
    }


def check(folder: Path) -> list[str]:
    """Problems between a committed receipt and the files it names; empty when they agree."""
    receipt = json.loads((folder / "receipt.json").read_text(encoding="utf-8"))
    problems = []
    if sha(ROOT / receipt["spec"]["path"]) != receipt["spec"]["sha256"]:
        problems.append("the spec changed since the render")
    for path, digest in {**receipt["render_code"], **receipt["fonts"]}.items():
        if sha(ROOT / path) != digest:
            problems.append(f"{path} changed since the render")
    for name, digest in receipt["outputs"].items():
        if not (folder / name).is_file() or sha(folder / name) != digest:
            problems.append(f"{name} does not match the receipt")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("folder", type=Path)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--verify", action="store_true")
    mode.add_argument("--check", action="store_true")
    args = parser.parse_args()
    folder = args.folder.resolve()
    if args.check:
        problems = check(folder)
        print("\n".join(problems) or "receipt matches")
        return 1 if problems else 0
    if args.verify:
        ref = json.loads((folder / "receipt.json").read_text(encoding="utf-8"))
        with tempfile.TemporaryDirectory() as tmp:
            new = build(folder / "spec.json", Path(tmp))
        rows = [("frame_chain_sha256", ref["frame_chain_sha256"], new["frame_chain_sha256"]),
                ("narration_wav_sha256", ref["narration_wav_sha256"], new["narration_wav_sha256"])]
        rows += [(name, digest, new["outputs"].get(name)) for name, digest in ref["outputs"].items()]
        for name, a, b in rows:
            print(f"{'MATCH' if a == b else 'DRIFT'}  {name}")
        return 0 if all(a == b for _, a, b in rows) else 1
    receipt = build(folder / "spec.json", folder)
    (folder / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({k: receipt[k] for k in ("slug", "seconds", "frames", "frame_chain_sha256")}))
    print("mp4", receipt["outputs"][f"{receipt['slug']}.mp4"])
    return 0


if __name__ == "__main__":
    sys.exit(main())

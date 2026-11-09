"""Build system/videos.json: one record per playable video on a page.

tools/structured_data.py turns each record into a schema.org VideoObject on the
page that plays it. A record holds only what the site already publishes: the
file, its poster, the label or caption the page gives it, the date git first
saw the file, and the duration read from the MP4 header.

    python tools/video_registry.py          rewrite system/videos.json
    python tools/video_registry.py --check  exit 1 if a page's videos are missing

Names and descriptions in the written file may be edited by hand; a rewrite
keeps any record whose contentUrl is unchanged.
"""
from __future__ import annotations

import argparse
import json
import struct
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "https://harperz9.github.io"
OUT = ROOT / "system/videos.json"
sys.path.insert(0, str(ROOT / "tools"))
from structured_data import candidates  # noqa: E402


class _Videos(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.found: list[dict] = []
        self._cur: dict | None = None
        self._heading: list[str] = []
        self._in_heading = False
        self.last_heading = ""

    def handle_starttag(self, tag, attrs):
        a = {k: v or "" for k, v in attrs}
        if tag in {"h1", "h2", "h3"}:
            self._in_heading, self._heading = True, []
        elif tag == "video" and "controls" in a:
            self._cur = {"poster": a.get("poster", ""), "label": a.get("aria-label", ""),
                         "src": a.get("src", ""), "heading": self.last_heading}
        elif tag == "source" and self._cur is not None and not self._cur["src"]:
            if a.get("src", "").lower().endswith((".mp4", ".webm")):
                self._cur["src"] = a["src"]

    def handle_endtag(self, tag):
        if tag in {"h1", "h2", "h3"} and self._in_heading:
            self._in_heading = False
            self.last_heading = " ".join("".join(self._heading).split())
        elif tag == "video" and self._cur is not None:
            if self._cur["src"]:
                self.found.append(self._cur)
            self._cur = None

    def handle_data(self, data):
        if self._in_heading:
            self._heading.append(data)


def mp4_seconds(path: Path) -> int | None:
    """Duration from the movie header (mvhd) box, or None when absent."""
    data = path.read_bytes()
    at = data.find(b"mvhd")
    if at < 0:
        return None
    version = data[at + 4]
    if version == 1:
        scale, duration = struct.unpack(">IQ", data[at + 24: at + 36])
    else:
        scale, duration = struct.unpack(">II", data[at + 16: at + 24])
    return round(duration / scale) if scale else None


def first_seen(path: Path) -> str | None:
    out = subprocess.run(["git", "log", "--diff-filter=A", "--format=%cs", "--", str(path.relative_to(ROOT))],
                         cwd=ROOT, capture_output=True, text=True, check=False).stdout.split()
    return out[-1] if out else None


def absolute(page: Path, href: str) -> tuple[str, Path]:
    target = (page.parent / href.split("?")[0]).resolve()
    return f"{ORIGIN}/{target.relative_to(ROOT).as_posix()}", target


def records(previous: dict[str, dict]) -> list[dict]:
    out = []
    for page in candidates(ROOT):
        parser = _Videos()
        parser.feed(page.read_text(encoding="utf-8"))
        rel = page.relative_to(ROOT).as_posix()
        for video in parser.found:
            url, file = absolute(page, video["src"])
            if not file.is_file():
                continue
            if url in previous:
                out.append(previous[url])
                continue
            label = video["label"].rstrip(".")
            record = {"page": rel, "contentUrl": url,
                      "name": video["heading"] or label, "description": label or video["heading"],
                      "thumbnailUrl": absolute(page, video["poster"])[0] if video["poster"] else None,
                      "uploadDate": first_seen(file)}
            seconds = mp4_seconds(file) if file.suffix == ".mp4" else None
            if seconds:
                record["duration"] = f"PT{seconds}S"
            out.append({k: v for k, v in record.items() if v})
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args(argv)
    previous = {}
    if OUT.is_file():
        previous = {v["contentUrl"]: v for v in json.loads(OUT.read_text(encoding="utf-8"))["videos"]}
    current = records(previous)
    if args.check:
        missing = sorted({v["contentUrl"] for v in current} - set(previous))
        if missing:
            print(f"videos.json lacks {len(missing)} video(s): {', '.join(missing)}", file=sys.stderr)
            print("run: python tools/video_registry.py", file=sys.stderr)
            return 1
        print("videos.json: current")
        return 0
    body = json.dumps({"videos": current}, indent=2, ensure_ascii=False) + "\n"
    OUT.write_text(body, encoding="utf-8", newline="\n")
    print(f"videos.json: {len(current)} video(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

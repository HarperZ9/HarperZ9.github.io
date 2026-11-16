"""Vendor raw-native's web host, Motion layer, guide characters and type atlas at one commit.

    python -m tools.raw_native_tree RAW_NATIVE_CHECKOUT SHA [--rewrite PATH ...]

Writes media/raw-native/tree-<sha7>/ in the repository's own layout (web/, templates/guides/,
docs/motion/), so the guides' relative imports (../../web/motion/...) resolve as they do upstream.
Files come from `git archive` of that commit, so their bytes are the commit's, whatever this
checkout's line endings. Tests and test pages are left out.

    python -m tools.raw_native_tree SUPERFRAME_CHECKOUT SHA --only PATH [PATH ...]

takes named files only, from the superframe repository (The Playground, where raw-native now lives
under native/), into media/raw-native/pick-<sha7>/ at the same paths they have upstream, so their
relative imports resolve. The front page takes Motion's timeline, paths, morphs, transitions and
drivers and the study palette this way. SHA256SUMS pins every file (CI checks
it); LICENSE-NOTE.md names the licence at that commit. --rewrite replaces "raw-native/tree-dev/"
with the new directory in the given source files (the lessons and the draft film scenes are
written against an uncommitted tree-dev copy until a commit is vendored).
"""

from __future__ import annotations

import argparse
import hashlib
import io
import subprocess
import sys
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATHS = ["web", "templates/guides", "docs/motion/hanken-grotesk-500.atlas.json"]


def keep(name: str) -> bool:
    # Pages are left out too, except Motion's capture page, which renders the films: the lessons
    # load modules, not upstream demo pages (one of which, web/shaders/showcase.html at c6b114d,
    # is not valid UTF-8 and trips the site's page checks).
    if name == "web/motion/capture.html":
        return True
    return not (name.endswith((".test.mjs", ".html")) or name.startswith("web/test/") or name.endswith("/") or "/__pycache__/" in name)


def vendor(repo: Path, sha: str, only: list[str] | None = None) -> Path:
    full = subprocess.run(["git", "-C", str(repo), "rev-parse", sha], capture_output=True, text=True, check=True).stdout.strip()
    out = ROOT / "media" / "raw-native" / f"{'pick' if only else 'tree'}-{full[:7]}"
    if out.exists():
        sys.exit(f"{out} exists; a vendored commit is never rewritten in place")
    tar = subprocess.run(["git", "-C", str(repo), "-c", "core.autocrlf=false", "archive", "--format=tar", full, *(only or PATHS)], capture_output=True, check=True).stdout
    sums = []
    with tarfile.open(fileobj=io.BytesIO(tar)) as t:
        for m in t.getmembers():
            if not m.isfile() or not (only or keep(m.name)):
                continue
            data = t.extractfile(m).read()
            dest = out / m.name
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            sums.append(f"{hashlib.sha256(data).hexdigest()}  {m.name}")
    licence = subprocess.run(["git", "-C", str(repo), "show", f"{full}:LICENSE"], capture_output=True, text=True, check=True).stdout.splitlines()[0].lstrip("# ")
    (out / "SHA256SUMS").write_bytes(("\n".join(sorted(sums, key=lambda s: s.split("  ", 1)[1])) + "\n").encode())
    if only:
        (out / "LICENSE-NOTE.md").write_bytes((
            "# Licence of this directory\n\n"
            f"These {len(sums)} files are taken from commit {full[:7]} of https://github.com/HarperZ9/superframe (The Playground), "
            "by the site's author, at the paths they have there. They are licensed under the licence in that repository at "
            f"that commit ({licence}). `SHA256SUMS` pins the files. The front page loads them.\n").encode())
        print(f"{out.relative_to(ROOT).as_posix()}: {len(sums)} files from {full}")
        return out
    (out / "LICENSE-NOTE.md").write_bytes((
        "# Licence of this directory\n\n"
        f"These files are raw-native's web host (`web/`), its explainer guide characters (`templates/guides/`) and the "
        f"Hanken Grotesk glyph atlas its Motion text uses (`docs/motion/`), from commit {full[:7]} of "
        "https://github.com/HarperZ9/raw-native, an engine by the site's author, with tests left out. They are licensed "
        f"under the licence in that repository at that commit ({licence}). `SHA256SUMS` pins the files. The playable "
        "lesson and the demos beside the explainer films (system/lessons/) load them.\n").encode())
    print(f"{out.relative_to(ROOT).as_posix()}: {len(sums)} files from {full}")
    return out


def rewrite(paths: list[str], new: str) -> None:
    for p in paths:
        f = Path(p)
        s = f.read_text(encoding="utf-8")
        if "raw-native/tree-dev/" in s:
            f.write_text(s.replace("raw-native/tree-dev/", f"raw-native/{new}/"), encoding="utf-8", newline="\n")
            print(f"rewrote {p}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("repo")
    ap.add_argument("sha")
    ap.add_argument("--rewrite", nargs="*", default=[])
    ap.add_argument("--only", nargs="*", default=None, help="take these files only, into pick-<sha7>/")
    a = ap.parse_args()
    out = vendor(Path(a.repo), a.sha, a.only)
    rewrite(a.rewrite, out.name)
    return 0


if __name__ == "__main__":
    sys.exit(main())

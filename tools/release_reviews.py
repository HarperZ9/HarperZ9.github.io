"""Reviewed release spine: one pin file per path, one review file per change.

The release spine is the set of published files whose exact bytes are reviewed before they
ship. Two directories hold the record:

- ``tests/release-pins/<path>.pin`` exists for every release path. It holds one line: the id
  of the review that covers the path's current bytes. Its presence puts the path in the spine.
- ``tests/release-reviews/<id>.json`` is one file per reviewed change:
  ``{"date": "YYYY-MM-DD", "note": "...", "paths": {"<path>": "<sha256>", ...}}``.
  The id is the file name without ``.json`` and starts with the date.

The check: for every pin, the named review exists, names that path, and its sha256 equals the
path's current bytes (CRLF and CR read as LF, except .pdf and .png).

Why two directories. A change adds a new review file, which never conflicts with another
change. It rewrites the one-line pin of each path it touched, so two changes to different
paths touch different pin files and merge cleanly, while two changes to the same path rewrite
the same line and conflict in git. That conflict is wanted: the merged bytes of that path have
not been reviewed by either change.

Recording a change (run from the repository root):

    python -m tools.release_reviews record 2026-10-16-my-change --note "What changed and why" \\
        studio.html system/routes.js
    python -m tools.release_reviews record 2026-10-16-my-change --note "..." --stale
    python -m tools.release_reviews check

``--stale`` records every pinned path whose bytes no longer match its review. Naming a path
that has no pin adds it to the spine. Removing a path from the spine is deleting its pin file.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PIN_DIR = Path("tests/release-pins")
REVIEW_DIR = Path("tests/release-reviews")
PIN_SUFFIX = ".pin"
BINARY_SUFFIXES = {".pdf", ".png"}
REVIEW_ID = re.compile(r"^(\d{4}-\d{2}-\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*$")
SHA256 = re.compile(r"^[0-9a-f]{64}$")


def path_digest(root: Path, relative: str) -> str:
    """SHA-256 of a release file, reading CRLF and CR as LF for text files."""
    payload = (root / relative).read_bytes()
    if Path(relative).suffix.lower() not in BINARY_SUFFIXES:
        payload = payload.replace(b"\r\n", b"\n").replace(b"\r", b"\n")
    return hashlib.sha256(payload).hexdigest()


def legacy_fingerprint(digests: dict[str, str]) -> str:
    """The single aggregate the test pinned before 16 October 2026."""
    records = [f"{path}\t{digests[path]}" for path in sorted(digests)]
    return hashlib.sha256(("\n".join(records) + "\n").encode()).hexdigest()


def load_pins(root: Path = ROOT) -> dict[str, str]:
    """Map each release path to the review id in its pin file."""
    base = root / PIN_DIR
    pins = {}
    for pin in sorted(base.rglob(f"*{PIN_SUFFIX}")):
        relative = pin.relative_to(base).as_posix()[: -len(PIN_SUFFIX)]
        pins[relative] = pin.read_text(encoding="utf-8").strip()
    return pins


def load_reviews(root: Path = ROOT) -> dict[str, dict]:
    reviews = {}
    for path in sorted((root / REVIEW_DIR).glob("*.json")):
        reviews[path.stem] = json.loads(path.read_text(encoding="utf-8"))
    return reviews


def review_problems(review_id: str, review: dict) -> list[str]:
    """Schema problems in one review file."""
    match = REVIEW_ID.match(review_id)
    if not match:
        return [f"{review_id}: id must be YYYY-MM-DD-lower-case-words"]
    problems = []
    if review.get("date") != match.group(1):
        problems.append(f"{review_id}: date must be {match.group(1)}")
    if not str(review.get("note", "")).strip():
        problems.append(f"{review_id}: note is empty")
    paths = review.get("paths")
    if not isinstance(paths, dict) or not paths:
        return problems + [f"{review_id}: paths must name at least one path"]
    for path, digest in paths.items():
        if not isinstance(digest, str) or not SHA256.match(digest):
            problems.append(f"{review_id}: {path} has no sha256")
    return problems


def verify(root: Path = ROOT) -> list[str]:
    """Every problem with the pins and reviews under ``root``; empty means reviewed."""
    pins = load_pins(root)
    reviews = load_reviews(root)
    problems = [p for rid, review in reviews.items() for p in review_problems(rid, review)]
    if not pins:
        problems.append("no release pins found")
    for path, review_id in pins.items():
        review = reviews.get(review_id)
        if review is None:
            problems.append(f"{path}: pin names missing review {review_id!r}")
        elif path not in review.get("paths", {}):
            problems.append(f"{path}: review {review_id} does not name this path")
        elif not (root / path).is_file():
            problems.append(f"{path}: pinned file is missing")
        elif path_digest(root, path) != review["paths"][path]:
            problems.append(f"{path}: bytes differ from review {review_id}")
    return problems


def stale_paths(root: Path = ROOT) -> list[str]:
    """Pinned paths whose current bytes are not the bytes their review names."""
    reviews = load_reviews(root)
    stale = []
    for path, review_id in load_pins(root).items():
        named = reviews.get(review_id, {}).get("paths", {}).get(path)
        if not (root / path).is_file() or path_digest(root, path) != named:
            stale.append(path)
    return stale


def record(root: Path, review_id: str, note: str, paths: list[str], date: str | None = None) -> Path:
    """Write review ``review_id`` over ``paths`` and point each path's pin at it."""
    match = REVIEW_ID.match(review_id)
    if not match:
        raise ValueError(f"review id {review_id!r} must be YYYY-MM-DD-lower-case-words")
    target = root / REVIEW_DIR / f"{review_id}.json"
    if target.exists():
        raise FileExistsError(f"{target} exists; pick a new id for a new change")
    if not paths:
        raise ValueError("name at least one path, or use --stale")
    digests = {}
    for path in sorted(set(paths)):
        if not (root / path).is_file():
            raise FileNotFoundError(path)
        digests[path] = path_digest(root, path)
    review = {"date": date or match.group(1), "note": note, "paths": digests}
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(review, indent=2) + "\n", encoding="utf-8", newline="\n")
    for path in digests:
        pin = root / PIN_DIR / f"{path}{PIN_SUFFIX}"
        pin.parent.mkdir(parents=True, exist_ok=True)
        pin.write_text(review_id + "\n", encoding="utf-8", newline="\n")
    return target


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("check", help="verify every pin against its review")
    commands.add_parser("stale", help="list pinned paths whose bytes changed")
    rec = commands.add_parser("record", help="record a reviewed change")
    rec.add_argument("review_id")
    rec.add_argument("--note", required=True)
    rec.add_argument("--stale", action="store_true", help="record every stale pinned path")
    rec.add_argument("paths", nargs="*")
    args = parser.parse_args(argv)
    if args.command == "record":
        paths = list(args.paths) + (stale_paths(ROOT) if args.stale else [])
        print(record(ROOT, args.review_id, args.note, paths).relative_to(ROOT).as_posix())
        return 0
    found = stale_paths(ROOT) if args.command == "stale" else verify(ROOT)
    for line in found:
        print(line)
    return 1 if found and args.command == "check" else 0


if __name__ == "__main__":
    sys.exit(main())

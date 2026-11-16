"""Prove that a restamp changed stamp lines and nothing else.

    python tools/stamp_only_diff.py [BASE]     # BASE defaults to HEAD; compares it with the working tree

For every file that differs from BASE, each line is compared with its line in BASE after every
world asset revision (world-<10 hex>) is replaced by one placeholder. A file passes only if it has
the same number of lines and every line is then identical. Exit 1 names the first lines that differ
in some other way. Files listed in ALLOWED_OTHER (the release review a restamp records, and the pin
that names it) are reported and not read as stamps.
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REVISION = re.compile(rb"world-[0-9a-f]{10}")
ALLOWED_OTHER = re.compile(r"^tests/release-(?:reviews|pins)/")


def git(*args: str) -> bytes:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, check=True).stdout


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else "HEAD"
    changed = [n for n in git("diff", "--name-only", "-z", base).decode("utf-8").split("\0") if n]
    added = [n for n in git("ls-files", "--others", "--exclude-standard", "-z").decode("utf-8").split("\0") if n]
    files = lines = 0
    other, faults, samples = [], [], []
    for name in changed + added:
        if ALLOWED_OTHER.search(name):
            other.append(name)
            continue
        if name in added:
            faults.append(f"{name}: a new file, not a stamp")
            continue
        before = git("show", f"{base}:{name}").split(b"\n")
        after = (ROOT / name).read_bytes().replace(b"\r\n", b"\n").split(b"\n")
        if len(before) != len(after):
            faults.append(f"{name}: {len(before)} lines before, {len(after)} after")
            continue
        files += 1
        for number, (a, b) in enumerate(zip(before, after), 1):
            if a == b:
                continue
            if REVISION.sub(b"world-0000000000", a) != REVISION.sub(b"world-0000000000", b):
                faults.append(f"{name}:{number}: differs beyond the stamp\n  - {a[:200]!r}\n  + {b[:200]!r}")
                continue
            lines += 1
            if len(samples) < 3 and (not samples or name.split("/")[0] != samples[-1][0].split("/")[0]):
                samples.append((name, number, a.decode("utf-8", "replace"), b.decode("utf-8", "replace")))
    print(f"{files} files differ from {base} by stamp lines only: {lines} lines, each identical once the revision is set aside")
    for name, number, a, b in samples:
        print(f"  {name}:{number}\n    - {a.strip()[:170]}\n    + {b.strip()[:170]}")
    if other:
        print(f"{len(other)} release-review files also changed (not stamps, read separately): {', '.join(other)}")
    if faults:
        print(f"{len(faults)} changes are not stamps:\n" + "\n".join(faults[:20]))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

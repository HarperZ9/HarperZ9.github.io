# SPDX-License-Identifier: FSL-1.1-MIT
"""Check a vendored superstack file against its pinned SHA-256.

  python check_vendored.py path/to/contracts.mjs --expect <sha256>
  python check_vendored.py path/to/superstack.py --sums SHA256SUMS
  python check_vendored.py path/to/contracts.mjs --sums SHA256SUMS --as superstack.mjs

--expect compares with one pinned hash. --sums reads a SHA256SUMS file from a
superstack release and looks the file up by name (--as gives the upstream
name when the copy was renamed). The hash covers the exact bytes, so a copy
with CRLF line endings fails; the script says so when that is the cause.
Standard library only; exit 0 on a match, 1 on any mismatch, 2 on bad usage.
"""
from __future__ import annotations

import hashlib
import sys
from pathlib import Path

UPSTREAM = ("superstack.py", "superstack.mjs", "superstack.hpp")


def read_sums(path: Path) -> dict[str, str]:
    out = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        digest, name = line.split(maxsplit=1)
        out[name.lstrip("*")] = digest.lower()
    return out


def check(path: Path, expect: str) -> bool:
    data = path.read_bytes()
    got = hashlib.sha256(data).hexdigest()
    if got == expect:
        print(f"MATCH  {path}  {got}")
        return True
    print(f"DRIFT  {path}\n  pinned {expect}\n  found  {got}")
    if b"\r\n" in data and hashlib.sha256(data.replace(b"\r\n", b"\n")).hexdigest() == expect:
        print("  cause: CRLF line endings; check the file out with LF (add `<path> -text` or "
              "`<path> text eol=lf` to .gitattributes)")
    return False


def main(argv: list[str]) -> int:
    args, opts = [], {}
    it = iter(argv)
    for a in it:
        if a in ("--expect", "--sums", "--as"):
            opts[a] = next(it, None)
        else:
            args.append(a)
    if not args or (("--expect" in opts) == ("--sums" in opts)):
        print(__doc__)
        return 2
    ok = True
    sums = read_sums(Path(opts["--sums"])) if "--sums" in opts else {}
    for f in args:
        p = Path(f)
        if "--expect" in opts:
            ok &= check(p, opts["--expect"].lower())
            continue
        name = opts.get("--as") or p.name
        if name not in sums:
            print(f"no pinned hash for {name}; known: {', '.join(sorted(sums)) or 'none'}")
            ok = False
            continue
        ok &= check(p, sums[name])
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

"""tools/ holds generators and their source pages. GitHub Pages does not publish it.

Before 15 November 2026 the folder was served: 38 HTML files that are generator inputs, with the
scripts beside them. Nothing on the site loads from it, so _config.yml excludes it. This test
keeps both halves true: the exclusion stays, and no published page comes to depend on the folder.
"""
from __future__ import annotations

import json
import posixpath
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NOT_PUBLISHED = re.compile(r"^(?:home|tests|docs|tools)/|(?:^|/)[_.][^/]*|\.py$")
LOADS = re.compile(r"""(?:\b(?:href|src|action|poster|data)\s*=\s*|\bimport\s*\(?\s*|\bfrom\s+|\bfetch\s*\(\s*|url\(\s*)["']?([^"'\s)>]+)""")


def published(suffixes: tuple[str, ...]) -> list[str]:
    listed = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", check=True).stdout.split("\n")
    return [name for name in listed if name.endswith(suffixes) and not NOT_PUBLISHED.search(name) and (ROOT / name).is_file()]


def loads_from_tools(name: str, text: str) -> list[str]:
    found = []
    for target in LOADS.findall(text):
        if re.match(r"[a-z][a-z0-9+.-]*:|//|#", target, re.I):
            continue
        path = target.split("#")[0].split("?")[0]
        resolved = path.lstrip("/") if path.startswith("/") else posixpath.normpath(posixpath.join(posixpath.dirname(name), path))
        if resolved.startswith("tools/"):
            found.append(f"{name}: {target}")
    return found


def test_pages_build_excludes_tools() -> None:
    config = (ROOT / "_config.yml").read_text(encoding="utf-8")
    block = config.split("exclude:", 1)[1].split("\n\n", 1)[0]
    entries = [line.split("#")[0].strip().lstrip("- ").strip('"') for line in block.splitlines() if line.strip().startswith("-")]
    assert "tools/" in entries, entries


def test_nothing_published_loads_from_tools() -> None:
    found = []
    for name in published((".html", ".htm", ".js", ".mjs", ".css")):
        found += loads_from_tools(name, (ROOT / name).read_text(encoding="utf-8", errors="replace"))
    assert not found, "published files load from tools/, which is not published:\n" + "\n".join(found[:40])


def test_the_check_catches_a_load_from_tools() -> None:
    assert loads_from_tools("night-school.html", '<script type="module" src="tools/school/fill_block.mjs"></script>')
    assert loads_from_tools("world/site/x.mjs", 'import { a } from "../../tools/explainer/a.mjs";')
    assert not loads_from_tools("night-school.html", "<p>written by tools/school/fill_block.mjs from the lesson</p>")
    assert not loads_from_tools("a.html", '<a href="https://github.com/HarperZ9/HarperZ9.github.io/tree/main/tools/school">source</a>')


def test_every_address_under_tools_has_moved() -> None:
    rows = json.loads((ROOT / "site-src/world/addresses.json").read_text(encoding="utf-8"))["rows"]
    under = [row for row in rows if row["path"].startswith("/tools/")]
    assert under, "the ledger lists the addresses tools/ once answered at"
    for row in under:
        assert row["kind"] == "moved" and not row["to"].startswith("/tools/"), row

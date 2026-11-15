"""The world asset revision must come out the same on every checkout.

scripts/world-asset-revision.mjs hashes the bytes of every file under world/site and every
stylesheet under studies. A file Git may check out with CRLF line endings gives a Windows
checkout a different revision from Linux, and the stamper then rewrites every world page.
On 15 November 2026 world/site/floor-rows.htm was that file: .htm had no line-ending rule.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def hashed_inputs() -> list[tuple[str, str, str]]:
    out = subprocess.run(
        ["git", "ls-files", "--eol", "--", "world/site", "studies"],
        cwd=ROOT, capture_output=True, text=True, encoding="utf-8", check=True,
    ).stdout
    rows = []
    for line in out.splitlines():
        info, _, name = line.partition("\t")
        index, _worktree, attr = (info.split(None, 2) + [""])[:3]
        if name.startswith("world/site/") or name.endswith(".css"):
            rows.append((name, index, attr.strip()))
    return rows


def test_every_text_file_hashed_into_the_revision_is_pinned_to_lf() -> None:
    rows = hashed_inputs()
    assert len(rows) > 50, "the revision's inputs were not found"
    loose = [name for name, index, attr in rows if index != "i/-text" and "eol=lf" not in attr and "-text" not in attr]
    assert not loose, "add a 'text eol=lf' rule to .gitattributes for:\n" + "\n".join(loose)


def test_address_builder_stamps_the_page_it_writes() -> None:
    rev = json.loads((ROOT / "world/IMPORT.json").read_text(encoding="utf-8"))["assetRevision"]
    page = (ROOT / "404.html").read_text(encoding="utf-8")
    assets = re.findall(r'(?:href|src)="(/(?:world|studies)/[^"]+\.(?:css|js)[^"]*)"', page)
    assert assets and all(a.endswith(f"?v={rev}") for a in assets), assets


def test_builder_check_fails_on_a_page_it_did_not_write() -> None:
    node = shutil.which("node")
    if not node:
        pytest.skip("node is not installed")
    target = ROOT / "404.html"
    kept = target.read_bytes()
    try:
        target.write_bytes(kept.replace(b"?v=world-", b"?v=other-", 1))
        done = subprocess.run([node, "scripts/build-addresses.mjs", "--check"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    finally:
        target.write_bytes(kept)
    assert done.returncode == 1 and "404.html differs" in done.stderr, done.stderr
    again = subprocess.run([node, "scripts/build-addresses.mjs", "--check"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    assert again.returncode == 0, again.stderr

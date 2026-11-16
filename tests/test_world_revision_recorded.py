"""The recorded world asset revision must be the hash of the committed inputs.

scripts/world-asset-revision.mjs hashes the import record, the import patches, every file under
world/site and every stylesheet under studies, writes the result to world/IMPORT.json and stamps
it on every script and stylesheet link of the world's pages. Until 15 November 2026 nothing
compared the recorded value with the inputs: world/site changed, the stamp did not, and the
next run of the stamper on any branch rewrote 260 pages inside an unrelated change.

Three checks, so one faulty reading cannot hide a drift:

- this file computes the revision itself, from the bytes Git has committed or staged, and
  compares it with the recorded value;
- the stamper's own --check must agree, and must write nothing;
- a changed input must make that check fail.
"""
from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
STAMPER = "scripts/world-asset-revision.mjs"
FIX = "run `node scripts/world-asset-revision.mjs`, then `node scripts/build-addresses.mjs`, and commit the result"


def tracked(*folders: str) -> list[str]:
    out = subprocess.run(
        ["git", "ls-files", "-z", "--", *folders], cwd=ROOT, capture_output=True, check=True,
    ).stdout.decode("utf-8")
    return [name for name in out.split("\0") if name]


def code_unit_key(name: str) -> bytes:
    """JavaScript's default sort compares UTF-16 code units; the stamper sorts that way."""
    return name.encode("utf-16-be")


def computed_revision() -> str:
    digest = hashlib.sha256()
    record = json.loads((ROOT / "world/IMPORT.json").read_text(encoding="utf-8"))
    for item in record["files"]:
        digest.update(f"{item['path']}:{item['sourceSha256']}\n".encode("utf-8"))
    config = json.loads((ROOT / "scripts/import-mission-control.config.json").read_text(encoding="utf-8"))
    digest.update(json.dumps(config.get("patches") or [], separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
    site = sorted(tracked("world/site"), key=code_unit_key)
    sheets = sorted((n for n in tracked("studies") if n.endswith(".css")), key=code_unit_key)
    for name in [*site, *sheets]:
        digest.update(f"{name}:{hashlib.sha256((ROOT / name).read_bytes()).hexdigest()}\n".encode("utf-8"))
    return "world-" + digest.hexdigest()[:10]


def recorded_revision() -> str:
    return json.loads((ROOT / "world/IMPORT.json").read_text(encoding="utf-8"))["assetRevision"]


def test_recorded_revision_is_the_hash_of_the_committed_inputs() -> None:
    assert recorded_revision() == computed_revision(), (
        f"world/IMPORT.json records {recorded_revision()} and the inputs hash to {computed_revision()}: "
        f"something under world/site, studies/*.css, the import record or its patches changed without a restamp; {FIX}"
    )


def test_every_stamp_on_a_world_page_is_the_recorded_revision() -> None:
    rev = recorded_revision()
    stamp = re.compile(r'\b(?:href|src)="[^"#:]+\.(?:css|js)\?v=(world-[0-9a-f]{10})"')
    pages = [n for n in tracked("world", "studies", "findings", "index.html", "404.html", "floor.html", "playground") if n.endswith(".html")]
    assert len(pages) > 200, "the world's pages were not found"
    stale = sorted({f"{name}: {found}" for name in pages for found in stamp.findall((ROOT / name).read_text(encoding="utf-8")) if found != rev})
    assert not stale, f"{len(stale)} stamps differ from {rev}; {FIX}:\n" + "\n".join(stale[:20])


def run_check() -> subprocess.CompletedProcess[str]:
    node = shutil.which("node")
    if not node:
        pytest.skip("node is not installed")
    return subprocess.run([node, STAMPER, "--check"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")


def test_stampers_own_check_agrees_and_writes_nothing() -> None:
    before = (ROOT / "world/IMPORT.json").read_bytes()
    done = run_check()
    assert done.returncode == 0, done.stderr
    assert recorded_revision() in done.stdout
    assert (ROOT / "world/IMPORT.json").read_bytes() == before


def test_check_fails_when_an_input_changes_without_a_restamp() -> None:
    target = ROOT / "world/site/floor-rows.htm"
    kept = target.read_bytes()
    try:
        target.write_bytes(kept + b"<!-- changed -->\n")
        assert computed_revision() != recorded_revision()
        done = run_check()
    finally:
        target.write_bytes(kept)
    assert done.returncode == 1 and "differs" in done.stderr, done.stderr
    assert run_check().returncode == 0

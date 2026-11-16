"""The generated indexes must be what their generators write today.

Until 15 November 2026 nothing compared system/routes.js, home/src/site-routes.ts, site-index.html
or the work index rows with their generators. Pages changed, the indexes did not, and the next
person to run a generator found unrelated changes in their diff. Each generator now has a --check
that writes nothing and exits 1 when its output would change; this file runs them on every pull
request, and proves each one fails on a file it did not write.

    node scripts/render-route-registry.mjs --check   routes.js, site-routes.ts, then site-index.html
    node scripts/work-index.mjs --check              floor.html's first rows and world/site/floor-rows.htm
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
CHECKS = {
    "scripts/render-route-registry.mjs": ("system/routes.js", "home/src/site-routes.ts", "site-index.html"),
    "scripts/work-index.mjs": ("world/site/floor-rows.htm",),
}


def check(script: str) -> subprocess.CompletedProcess[str]:
    node = shutil.which("node")
    if not node:
        pytest.skip("node is not installed")
    return subprocess.run([node, script, "--check"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")


def written() -> dict[str, bytes]:
    return {name: (ROOT / name).read_bytes() for names in CHECKS.values() for name in names}


@pytest.mark.parametrize("script", sorted(CHECKS))
def test_generated_index_is_in_step_and_the_check_writes_nothing(script: str) -> None:
    before = written()
    done = check(script)
    assert done.returncode == 0, f"{script} --check:\n{done.stderr}"
    assert written() == before, f"{script} --check wrote a file"


@pytest.mark.parametrize("script, name", [(script, name) for script, names in sorted(CHECKS.items()) for name in names])
def test_check_fails_on_a_file_the_generator_did_not_write(script: str, name: str) -> None:
    target = ROOT / name
    kept = target.read_bytes()
    # one word changed inside the generated text, the way a hand edit or a stale copy would differ
    marker = b"Playground" if b"Playground" in kept else b"wi-row"
    assert marker in kept, f"{name} holds no text this test can change"
    try:
        target.write_bytes(kept.replace(marker, marker + b" changed", 1))
        done = check(script)
    finally:
        target.write_bytes(kept)
    assert done.returncode == 1 and "differ" in done.stderr, f"{script} --check accepted a changed {name}:\n{done.stdout}{done.stderr}"


def test_work_index_follows_a_moved_address_to_its_page() -> None:
    """A row whose page became a moved row in the address ledger keeps its link to where the page went."""
    rows = (ROOT / "world/site/floor-rows.htm").read_text(encoding="utf-8")
    ledger = (ROOT / "site-src/world/addresses.json").read_text(encoding="utf-8")
    assert '{"path":"/quanta-color.html","kind":"moved"' in ledger, "the example row is no longer a moved row; pick another"
    assert 'href="/build-color.html"' in rows

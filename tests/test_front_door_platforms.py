"""The front door's index of the work (site-src/world/platforms.mjs, built into index.html).

Each platform row must say what it does, link to a page that exists, and carry a Verified line that names the
version it shows. The voice rules for public pages hold: no em dashes, no local paths.
"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _platforms() -> list[dict]:
    script = "import('./site-src/world/platforms.mjs').then(m => console.log(JSON.stringify({p: m.PLATFORMS, c: m.CHECKED})))"
    out = subprocess.run(["node", "--input-type=module", "-e", script], cwd=ROOT, capture_output=True, text=True, check=True)
    data = json.loads(out.stdout)
    assert re.fullmatch(r"\d{1,2} [A-Z][a-z]+ 20\d\d", data["c"]), data["c"]
    return data["p"]


def test_every_platform_row_is_complete_and_its_links_resolve():
    rows = _platforms()
    assert len(rows) >= 5
    for p in rows:
        assert p["name"] and p["what"] and p["see"] and p["more"], p["id"]
        for href in (p["see"][0], p["more"][0]):
            if href.startswith("/"):
                target = ROOT / href.lstrip("/")
                assert target.exists() or (target / "index.html").exists(), f"{p['id']}: {href} does not exist"
        plate = ROOT / (p["plate"].lstrip("/") + ".webp")
        assert plate.exists() and (ROOT / (p["plate"].lstrip("/") + ".avif")).exists(), plate


def test_a_shown_version_carries_a_verified_line_naming_it():
    for p in _platforms():
        if p.get("version"):
            assert p.get("verified"), f"{p['id']} shows {p['version']} with no Verified line"
            assert p["version"] in p["verified"], f"{p['id']}: the Verified line does not name {p['version']}"


def test_the_rows_keep_the_public_voice():
    text = json.dumps(_platforms(), ensure_ascii=False)
    assert "—" not in text, "em dash in the front door's platforms"
    assert not re.search(r"[A-Za-z]:[\\/](?:dev|Users)", text), "local path in the front door's platforms"


def test_the_home_page_carries_every_platform():
    home = (ROOT / "index.html").read_text(encoding="utf-8")
    assert 'id="work"' in home and 'href="#work"' in home
    for p in _platforms():
        assert f'id="pf-{p["id"]}"' in home, p["id"]
    assert home.count('id="say"') == 1, "the home has one live region"

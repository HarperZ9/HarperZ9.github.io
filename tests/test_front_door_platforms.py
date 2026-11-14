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
        assert p["product"] and p["what"] and p["see"] and p["more"], p["id"]
        for href in (p["see"][0], p["more"][0]):
            if href.startswith("#"):
                continue
            if href.startswith("/"):
                target = ROOT / href.split("#")[0].lstrip("/")
                assert target.exists() or (target / "index.html").exists(), f"{p['id']}: {href} does not exist"


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
    assert 'id="work"' in home
    # the six landmarks, in the author's order (2026-11-09), lead the arrival's ways in and sit on the page in order
    order = ["lm-buildlang", "lm-flywheel", "lm-engine", "lm-game", "site", "everything"]
    for anchor in order:
        assert f'href="#{anchor}"' in home and f'id="{anchor}"' in home, anchor
    positions = [home.index(f'id="{anchor}"') for anchor in order]
    assert positions == sorted(positions), "the landmarks are out of their fixed order"
    for p in _platforms():
        assert f'id="pf-{p["id"]}"' in home, p["id"]
    assert home.count('id="say"') <= 1, "the home has at most one live region"


def test_the_menu_leads_with_the_six_landmarks_on_every_generated_page():
    """Landmarks keep their place (DESIGN-RULES.md): the same six words, in the same order, on every page."""
    # 13 November 2026: the third landmark is shown as The Playground (author, 2026-11-11: "the playground is the
    # rendering engine. It's the engine."); its place in the order is unchanged.
    words = ["BuildLang", "Flywheel", "The Playground", "Game", "Site", "Everything"]
    for page in ("index.html", "buildlang.html", "low-water.html", "floor.html", "credits.html"):
        html = (ROOT / page).read_text(encoding="utf-8")
        menu = html.split('<ul class="o-places">', 1)[1].split("</ul>", 1)[0]
        found = re.findall(r'<span class="o-word"[^>]*>([^<]+)</span>', menu)
        assert found[:6] == words, (page, found[:6])


def test_the_home_versions_come_from_the_fetched_releases():
    releases = json.loads((ROOT / "site-src" / "world" / "releases.json").read_text(encoding="utf-8"))["products"]
    home = (ROOT / "index.html").read_text(encoding="utf-8")
    for pid in ("buildlang", "flywheel", "raw-native", "superframe", "cmmns", "articulate"):
        g = releases[pid]["github"]
        assert f'href="{g["url"]}">{g["version"]}</a>' in home, pid


def test_a_figure_names_the_first_release_that_carried_its_change():
    """buildlang.html and low-water.html (scripts/build-product-pages.mjs) say which release first contained each
    merged pull request, read from the release tags by scripts/fetch-releases.mjs. Stating the latest release there
    is the fault this guards: #136 shipped in 1.11.0 and #158 in 1.12.0, whatever the latest release is."""
    products = json.loads((ROOT / "site-src" / "world" / "releases.json").read_text(encoding="utf-8"))["products"]
    latest = products["buildlang"]["github"]["version"]
    known = {136: "1.11.0", 158: "1.12.0"}
    for row, page in (("buildlang-page", "buildlang.html"), ("low-water", "low-water.html")):
        html = (ROOT / page).read_text(encoding="utf-8")
        for pr in products[row]["prs"]:
            if pr["repo"] != "HarperZ9/buildlang" or not pr["merged"]:
                continue
            assert "firstRelease" in pr, f'{row} #{pr["number"]}: no firstRelease; run node scripts/fetch-releases.mjs'
            first = pr["firstRelease"]
            if pr["number"] in known:
                assert first and first["version"] == known[pr["number"]], (row, pr["number"], first)
            cited = re.findall(rf'buildlang #{pr["number"]}, merged [^<]*?\({pr["commit"]}\)([^<]*)</a>', html)
            want = f', first released in {first["version"]}' if first else f", on main after {latest}"
            assert all(c == want for c in cited), (page, pr["number"], cited, want)
    low = (ROOT / "low-water.html").read_text(encoding="utf-8")
    assert "first released in 1.11.0" in low and "first released in 1.12.0" in low

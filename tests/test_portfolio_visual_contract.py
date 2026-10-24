"""Contracts for the front door, the home page rebuilt on 23 October 2026.

The home page is static markup: a name, one line, five routes, a generated form and
eight facets, each with a panel. A small script turns the facet list into tabs, draws
the form and wakes the demos. Without the script the same markup reads as a plain
list with every panel open. These tests hold that shape, the budget and the fallbacks.
"""

from __future__ import annotations

import gzip
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
HOME_INDEX = ROOT / "home" / "index.html"
SRC = ROOT / "home" / "src"
FACETS = ("here", "flywheel", "articulate", "daylight", "buildlang", "engine", "low-water", "writing", "work")

EM_DASH = "—"
EN_DASH = "–"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def deployed_assets() -> tuple[Path, Path]:
    src = read(INDEX)
    js = re.findall(r'src="/(assets/index-[\w-]+\.js)"', src)
    css = re.findall(r'href="/(assets/index-[\w-]+\.css)"', src)
    assert len(js) == 1 and len(css) == 1, "the home page loads one hashed script and one hashed sheet"
    return ROOT / js[0], ROOT / css[0]


def body(src: str) -> str:
    return src.split("<body", 1)[1]


def panel(src: str, facet: str) -> str:
    return src.split(f'<section class="fd-panel" id="{facet}"', 1)[1].split("</section>", 1)[0]


def test_source_and_deployed_page_carry_the_same_body() -> None:
    built = re.sub(r'\s*<script type="module" crossorigin src="/assets/[^"]+"></script>', "", body(read(INDEX)))
    source = re.sub(r'\s*<script type="module" src="/src/main.ts"></script>', "", body(read(HOME_INDEX)))
    assert built.split("</body>")[0].strip() == source.split("</body>")[0].strip()


def test_head_keeps_canonical_social_and_structured_data() -> None:
    for page in (INDEX, HOME_INDEX):
        src = read(page)
        head = src.split("</head>", 1)[0]
        assert '<link rel="canonical" href="https://harperz9.github.io/" />' in head
        assert 'property="og:image"' in head and 'name="twitter:card"' in head
        assert "<!-- structured-data:begin (tools/structured_data.py) -->" in head
        assert '"@type":"Person"' in head
        assert 'data-home-shell="front-door"' in src


def test_above_the_fold_is_a_name_one_line_and_at_most_five_routes() -> None:
    src = body(read(HOME_INDEX))
    assert src.count("<h1") == 1
    assert '<h1 class="fd-name">Zain Dana Harper</h1>' in src
    line = re.search(r'<p class="fd-line">([^<]+)</p>', src)
    assert line and line.group(1).count(".") == 1, "one sentence under the name"
    nav = src.split('<nav class="fd-nav"', 1)[1].split("</nav>", 1)[0]
    routes = re.findall(r'<a href="([^"]+)">', nav)
    assert 1 <= len(routes) <= 5
    for href in routes:
        assert (ROOT / href.lstrip("/")).is_file(), href


def test_every_facet_has_a_panel_a_benefit_and_a_working_link() -> None:
    src = body(read(HOME_INDEX))
    index = src.split('<nav class="fd-facets"', 1)[1].split("</nav>", 1)[0]
    listed = re.findall(r'<a href="#([a-z-]+)" data-facet="\1">', index)
    assert listed == list(FACETS)
    for facet in FACETS:
        section = panel(src, facet)
        assert f'<h2 id="{facet}-h">' in section, facet
        assert 'class="fd-benefit"' in section, facet
        tries = re.findall(r'<a class="fd-try" href="([^"]+)"', section)
        assert len(tries) == 1, facet
        if tries[0].startswith("/"):
            assert (ROOT / tries[0].lstrip("/").split("#")[0]).is_file(), tries[0]


def test_media_in_the_panels_exists_and_describes_itself() -> None:
    src = body(read(HOME_INDEX))
    collage = src.split('<div class="fd-collage">', 1)[1].split("</div>", 1)[0]
    for tag in re.findall(r"<img\b[^>]*>", collage):
        # Decorative archive scans inside the aria-hidden form: empty alt, loaded after paint.
        assert 'alt=""' in tag and "data-srcset=" in tag, tag
        for ref in re.findall(r"/(media/front-door/\S+) \d+w", tag):
            assert (ROOT / ref).is_file(), ref
    credits = read(ROOT / "media" / "front-door" / "CREDITS.md")
    for name in ("astrolabe-met-1462", "volvelle-apianus-1540", "eye-1624", "eclipse-nasa-2017",
                 "concrete-layers", "heavenly-boat"):
        assert name in credits, name
    for tag in re.findall(r"<img\b[^>]*>", src.replace(collage, "")):
        assert re.search(r'\balt="[^"]{12,}"', tag), tag
        assert 'width="' in tag and 'height="' in tag, tag
        assert 'loading="lazy"' in tag, tag
        local = re.search(r'src="/([^"]+)"', tag)
        assert local and (ROOT / local.group(1)).is_file(), tag
    for ref in re.findall(r'(?:src|data-poster)="/(media/[^"]+)"', src):
        assert (ROOT / ref).is_file(), ref
    video = re.search(r"<video\b[^>]*>", src)
    assert video and 'preload="none"' in video.group(0) and "autoplay" not in src
    assert "data-poster=" in video.group(0), "the poster waits for its panel"
    assert '<track kind="captions"' in src


def test_without_javascript_the_page_reads_as_a_plain_list() -> None:
    src = body(read(HOME_INDEX))
    # The controls start hidden; the script reveals them. No panel starts hidden.
    for controls in re.findall(r'<div class="fd-choices"[^>]*>', src):
        assert " hidden" in controls
    assert '<label class="fd-wipe-control" hidden>' in src
    assert '<div class="fd-toys" hidden>' in src
    assert not re.search(r'<section class="fd-panel"[^>]*\shidden', src)
    assert "<noscript" not in src, "the static markup is the fallback; no second copy"
    css = read(SRC / "front-door.css")
    assert ".fd-orb{display:none}" in css, "the form only shows when the script can draw it"
    # A display rule on a control would beat the hidden attribute; the sheet restores it.
    assert ".fd-toys[hidden],.fd-choices[hidden],.fd-wipe-control[hidden]{display:none}" in css


def test_the_form_is_decorative_and_the_index_is_the_way_in() -> None:
    src = body(read(HOME_INDEX))
    assert '<div class="fd-form" aria-hidden="true">' in src
    assert 'role="status"' in src
    script = read(SRC / "front-door.ts")
    for token in ('"role", "tablist"', '"role", "tab"', '"role", "tabpanel"', "ArrowDown", "Home", "End",
                  "aria-selected", "aria-controls"):
        assert token in script, token
    assert 'class="fd-sound" aria-pressed="false"' in src
    assert "let enabled = false" in read(SRC / "sound.ts"), "sound starts off"


def test_motion_respects_reduced_motion() -> None:
    stage = read(SRC / "stage.ts")
    assert '"(prefers-reduced-motion: reduce)"' in stage
    assert "s.calm = still" in stage
    css = read(SRC / "front-door.css")
    assert "@media (prefers-reduced-motion:reduce)" in css
    assert "prefers-reduced-motion" in read(SRC / "front-door.ts")


def test_the_home_bundle_stays_inside_the_budget() -> None:
    js, css = deployed_assets()
    assert len(gzip.compress(js.read_bytes())) < 60_000, "hero script over 60 KB gzipped"
    assert len(gzip.compress(css.read_bytes())) < 20_000
    assert "createRoot" not in read(js), "the front door ships no React"


def test_no_em_or_en_dashes_in_home_sources_and_deployed_assets() -> None:
    paths = [HOME_INDEX, INDEX, *sorted(SRC.glob("*.ts")), SRC / "front-door.css", *deployed_assets()]
    for path in paths:
        text = read(path)
        assert EM_DASH not in text, f"em-dash in {path.name}"
        assert EN_DASH not in text, f"en-dash in {path.name}"

"""What every page owes a reader who arrives from somewhere else.

Eight real pages had no social card, so sharing the gallery, the retro engine,
or the loom produced a bare link with no picture. The cards are generated from
img/og/_card.html by tools/render_cards.py, which means the gap can reappear
the moment a page is added; these tests are what make that a failing build
rather than something noticed months later in someone else's timeline.
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGES = sorted(ROOT.glob("*.html"))


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def is_stub(source: str) -> bool:
    """A rename or move stub: it exists so an old link still resolves."""
    return 'http-equiv="refresh"' in source


def real_pages() -> list[Path]:
    return [p for p in PAGES if not is_stub(read(p))]


def test_every_real_page_states_what_it_is() -> None:
    for p in real_pages():
        src = read(p)
        assert re.search(r"<title>[^<]{6,}</title>", src), f"{p.name} has no usable title"
        desc = re.search(r'<meta name="description" content="([^"]{20,})"', src)
        assert desc, f"{p.name} has no description"


def test_every_real_page_has_a_card_that_exists() -> None:
    for p in real_pages():
        src = read(p)
        m = re.search(r'<meta property="og:image" content="([^"]+)"', src)
        assert m, f"{p.name} has no og:image, so a shared link shows no picture"
        rel = m.group(1).replace("https://harperz9.github.io/", "")
        assert (ROOT / rel).is_file(), f"{p.name} points at a missing card: {rel}"


def test_a_card_is_the_right_shape() -> None:
    """1200 x 630 is what the previews crop to. A card at another size gets
    cut somewhere unhelpful."""
    png = ROOT / "img" / "og" / "loom.png"
    assert png.is_file()
    head = png.read_bytes()[:33]
    assert head[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG"
    width = int.from_bytes(head[16:20], "big")
    height = int.from_bytes(head[20:24], "big")
    assert (width, height) == (1200, 630), f"card is {width}x{height}"


def test_card_data_parses_and_covers_the_cards() -> None:
    src = (ROOT / "img" / "og" / "cards-data.js").read_text(encoding="utf-8")
    body = re.search(r"window\.CARD_DATA\s*=\s*(\{.*\});\s*$", src, re.S)
    assert body, "cards-data.js is no longer a plain object literal"
    data = json.loads(body.group(1))
    assert len(data) >= 60
    for key, entry in data.items():
        assert entry.get("headline"), f"{key} has no headline"
        assert entry.get("role"), f"{key} has no role"


def test_the_card_template_uses_the_word_it_is_given() -> None:
    """The template derived the word from the key and ignored data.word, so
    every entry carried a dead field and a hyphenated key rendered camelCase."""
    src = (ROOT / "img" / "og" / "_card.html").read_text(encoding="utf-8")
    assert "data.word||rhino(key)" in src.replace(" ", "")


def test_headings_start_at_one_and_skip_nothing() -> None:
    for p in real_pages():
        body = re.sub(r"<script.*?</script>|<style.*?</style>|<!--.*?-->", " ",
                      read(p), flags=re.S)
        levels = [int(m.group(1)) for m in re.finditer(r"<h([1-6])\b", body)]
        if not levels:
            continue
        assert levels.count(1) == 1, f"{p.name} has {levels.count(1)} h1 elements"
        skips = [(levels[i - 1], levels[i]) for i in range(1, len(levels))
                 if levels[i] - levels[i - 1] > 1]
        assert not skips, f"{p.name} skips heading levels: {skips[:3]}"


def test_no_page_centres_its_body_as_a_flex_row() -> None:
    """nav.js injects the navigation and a route figure as children of body.
    One page set body{display:flex;align-items:center;justify-content:center},
    so the injected bar became a second item in a centring row and rendered
    377px off the left edge of the window. A body that centres its children
    cannot host chrome it does not know about."""
    bad = []
    for p in PAGES:
        src = read(p)
        if is_stub(src):
            continue
        for block in re.findall(r"<style[^>]*>(.*?)</style>", src, re.S):
            for rule in re.findall(r"(?:^|[},])\s*body\s*\{([^}]*)\}", block):
                flat = rule.replace(" ", "")
                if "display:flex" in flat and "justify-content:center" in flat:
                    bad.append(p.name)
    assert not bad, f"body is a centring flex row on: {sorted(set(bad))}"


def test_the_injector_styles_what_it_injects() -> None:
    """nav.css is the floor for the things nav.js puts on a page.

    The old route-art injector rendered the raw social card into the document
    flow. The current injector enhances the existing opening block as a compact
    route header, so the stylesheet must style that component without relying
    on page-local rules.
    """
    css = (ROOT / "system" / "nav.css").read_text(encoding="utf-8")
    assert ".site-nav{" in css
    assert ".route-header{" in css
    assert ".route-header__path{" in css
    assert ".route-header__title{" in css
    assert ".route-header__summary{" in css
    assert ".route-art" not in css


def test_shared_navigation_keeps_a_forced_colors_focus_indicator() -> None:
    css = (ROOT / "system" / "nav.css").read_text(encoding="utf-8")
    forced_colors = re.search(r"@media \(forced-colors: active\)\{(.*?)\n\}", css, re.S)
    assert forced_colors
    block = forced_colors.group(1)
    for selector in (
        ".site-nav .sn-home:focus-visible",
        ".site-nav .sn-links a:focus-visible",
        ".site-nav .sn-more summary:focus-visible",
        ".site-nav .sn-more-list a:focus-visible",
    ):
        assert selector in block
    assert "outline:2px solid CanvasText" in block


def test_descriptions_are_concise_or_match_the_canonical_product_definition() -> None:
    """Ordinary pages keep search-sized summaries.

    Generated v4 product records deliberately reuse the one canonical product
    definition as metadata instead of introducing a second shortened claim.
    Pin those descriptions to the registry so length tolerance cannot become
    copy drift.
    """
    registry = json.loads((ROOT / "system" / "systems.json").read_text(encoding="utf-8"))
    products_by_href = {
        record["href"]: record
        for record in registry["systems"]
        if "#" not in record["href"]
    }
    for p in real_pages():
        source = read(p)
        m = re.search(r'<meta name="description" content="([^"]*)"', source)
        assert m, f"{p.name} has no description"
        description = m.group(1)
        record = products_by_href.get(p.name)
        if record:
            assert description == record["purpose"], p.name
            assert 40 <= len(description) <= 600, p.name
        else:
            n = len(description)
            assert 40 <= n <= 160, f"{p.name} description is {n} characters"


def test_descriptions_keep_the_house_voice() -> None:
    for p in real_pages():
        m = re.search(r'<meta name="description" content="([^"]*)"', read(p))
        text = m.group(1)
        assert "—" not in text, f"{p.name} description contains an em dash"
        for hype in ("revolutionary", "seamless", "cutting-edge", "game-changing", "world-class"):
            assert hype not in text.lower(), f"{p.name} description says {hype!r}"

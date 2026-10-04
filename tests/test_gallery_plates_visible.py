"""No stylesheet hides the specimen plates on an instrument surface.

system/system.css hides decorative specimen plates on reading pages (body.inner-clean), and
reading.css shows them again only where the body is not an .instrument-surface. Until
3 October 2026 the hide rule also matched the Gallery, so all 43 of its plates, Plate 14
included, loaded with display:none. tests/gallery-plates-visible.cjs checks the same thing in a
browser; this check needs only the files.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SHEETS = ["system/system.css", "system/reading.css", "system/instrument-editorial.css", "system/instrument-forms.css"]
INSTRUMENT_PAGES = ["gallery.html", "loom.html", "retro.html"]


def rules(css: str):
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    for selectors, body in re.findall(r"([^{}]+)\{([^{}]*)\}", css):
        yield [s.strip() for s in selectors.split(",")], body


def plate_hiders(css: str) -> list[str]:
    found = []
    for selectors, body in rules(css):
        if not re.search(r"display\s*:\s*none", body):
            continue
        found += [s for s in selectors if re.search(r"\.plate(?![-\w])", s)]
    return found


def test_the_gallery_is_an_instrument_surface_with_plates() -> None:
    html = (ROOT / "gallery.html").read_text(encoding="utf-8")
    body = re.search(r"<body[^>]*class=\"([^\"]*)\"", html).group(1).split()
    assert {"inner-clean", "instrument-surface"} <= set(body)
    assert len(re.findall(r"<figure class=\"plate[^\"]*\"", html)) >= 43
    assert 'data-plate="typeface"' in html


def test_no_rule_hides_plates_on_an_instrument_surface() -> None:
    for sheet in SHEETS:
        for selector in plate_hiders((ROOT / sheet).read_text(encoding="utf-8")):
            # A hide rule must either exclude instrument surfaces or name a plate family the
            # instrument pages do not use (the frontier briefing's .briefing-plate).
            assert ":not(.instrument-surface)" in selector or ".briefing-plate" in selector, (sheet, selector)


def test_the_check_catches_the_old_rule() -> None:
    old = "body.inner-clean:not(.studio-page):not(.studio-app) .plate:has(canvas[data-specimen]), body.x .y {display:none}"
    assert plate_hiders(old) == ["body.inner-clean:not(.studio-page):not(.studio-app) .plate:has(canvas[data-specimen])"]
    assert plate_hiders("body .plate-note{display:none}") == []

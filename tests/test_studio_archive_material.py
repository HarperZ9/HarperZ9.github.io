"""The published archive is studio material, not only a page of pictures.

165 works are published with a measurement each. This asserts the wiring that makes them usable:
the pen surface can take one as a material, the archive page can hand one over, the recipe can
hold which work it was, and the archive is reachable from the site navigation rather than from two
paragraphs of body copy.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STUDIO_HTML = ROOT / "studio.html"
STUDIO_JS = ROOT / "system" / "studio.js"
LIBRARY = ROOT / "system" / "studio-library.js"
SHELF = ROOT / "system" / "studio-shelf.js"
ARCHIVE_JS = ROOT / "system" / "session-archive.js"
ARCHIVE_HTML = ROOT / "session-archive.html"
NAV = ROOT / "system" / "nav.js"
MANIFEST = ROOT / "art" / "session-archive" / "manifest.json"


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def test_the_archive_is_a_material_the_pen_surface_can_draw() -> None:
    """A material needs a chip, a picker, and a branch that turns a work into a tone field."""
    html = read(STUDIO_HTML)
    js = read(STUDIO_JS)
    assert 'data-plot-material="archive"' in html, "the archive needs a material chip"
    assert 'id="plot-work-row"' in html and 'data-dropdown="plot-work"' in html
    assert '_plotMaterial === "archive"' in js, "the pen surface has to handle the material"
    assert "show(\"plot-work-row\", _plotMaterial === \"archive\")" in js
    # Archive is a tone-field material, so the image-method row must be offered for it. Without
    # this the eight methods are hidden and the material can only ever draw one way.
    tone = js[js.index("const isTone ="):js.index("const show = (id, on)")]
    assert '"archive"' in tone, "archive must count as a tone-field material"


def test_the_picker_bands_the_corpus_the_way_the_archive_page_does() -> None:
    """Someone arriving from the archive should find the corpus grouped the way they left it."""
    html = read(STUDIO_HTML)
    lib = read(LIBRARY)
    for band in ("all", "dark", "mid", "luminous", "monochrome", "warm", "cool", "collage"):
        assert f'data-plot-band="{band}"' in html, f"the {band} band is missing from the picker"
        assert f'key: "{band}"' in lib, f"the {band} band is missing from the catalogue"
    # The bands come from the manifest's own measurements, so they must be the same vocabulary.
    m = json.loads(read(MANIFEST))
    tones = {w["measure"]["tone"] for w in m["works"]}
    families = {w["measure"]["family"] for w in m["works"]}
    for value in tones | families:
        assert f'data-plot-band="{value}"' in html, f"the corpus has {value} works with no band chip"


def test_a_sheet_drawn_from_the_archive_pins_and_restores_exactly() -> None:
    """Unlike a picture or a captured frame, an archive work is published, so it comes back.

    That only holds if the recipe is allowed to carry which work it was, and if restore puts the
    picker back on it. Both were the failure mode the plate material already had to fix.
    """
    js = read(STUDIO_JS)
    shelf = read(SHELF)
    assert "workId:" in js, "the recipe has to record the work"
    assert 'r.material === "archive" && r.workId' in js, "restore has to act on it"
    assert "workId: STR" in shelf, "the shelf strips fields a kind cannot hold"
    # Restoring into a band that does not contain the pinned work would leave the picker on
    # whatever was selected before and draw a different work under the pin's name.
    assert "_libraryFilter = \"all\"" in js


def test_the_archive_page_hands_a_work_to_the_studio() -> None:
    """The link out and the boot path that receives it come from one module, so they cannot drift."""
    js = read(ARCHIVE_JS)
    lib = read(LIBRARY)
    studio = read(STUDIO_JS)
    assert 'import { studioLink } from "./studio-library.js"' in js
    assert "ui.draw.href = studioLink(w.id)" in js, "every work carries the link"
    assert "export function studioLink" in lib and "export function parseStudioLink" in lib
    assert "parseStudioLink" in studio, "the studio has to read what the archive writes"
    assert "bootPlotMaterial" in studio
    # The Atelier rewrites location.search on boot, so the query has to be snapshotted first or
    # the work id is gone before anything reads it.
    assert "__studioBootSearch" in read(STUDIO_HTML) and "__studioBootSearch" in studio


def test_a_hand_edited_link_cannot_strand_the_pen_surface() -> None:
    """A work id that does not resolve must be ignored, not drawn as something else."""
    lib = read(LIBRARY)
    assert "const ID = /^w\\d{3}$/" in lib, "work ids are validated by shape"
    assert lib.count("ID.test") >= 3, "validated on build, on link out, and on link in"


def test_two_callers_asking_for_one_material_share_one_fetch() -> None:
    """Acquisition is async and re-enters the draw, so racing callers each drew a sheet.

    The source's entry draw and a deep link both ask for the same work at once. Without a claim on
    the in-flight fetch that produced two identical sheets and two identical receipts, which reads
    as the studio having done the work twice.
    """
    js = read(STUDIO_JS)
    assert "_plotFieldPending" in js, "an in-flight acquisition needs a claim"
    assert "if (_plotFieldPending === key) return true" in js, "the second caller joins the first"
    # Releasing another acquisition's claim is how the double draw came back the first time it was
    # fixed: the catalogue continuation cleared the key an image fetch had already taken.
    assert "if (_plotFieldPending === key) _plotFieldPending = null" in js
    assert 'if (_plotFieldPending === "archive:catalogue") _plotFieldPending = null' in js


def test_the_picker_reports_the_selection_it_made() -> None:
    """The dropdown re-derives its own value from a mutation observer, which runs later.

    Reading the value back after a refill therefore reports the work that was showing a moment
    ago. A caller comparing before against after then sees no change when the selection did move,
    and the canvas keeps a sheet the picker no longer names.
    """
    js = read(STUDIO_JS)
    fill = js[js.index("function fillLibraryPicker"):js.index("function initPlotMapControls")]
    assert "const landed =" in fill and "return landed" in fill, \
        "the fill must return the selection it set, not the one it read back"
    assert "return sel.value" not in fill


def test_the_archive_is_reachable_from_the_site_navigation() -> None:
    """It was linked from two paragraphs of body copy and from nowhere else."""
    routes = read(ROOT / "system" / "routes.js")
    assert r'\"label\": \"Session archive\"' in routes
    assert r'\"href\": \"session-archive.html\"' in routes


def test_shared_nav_changes_reach_pages_that_cached_it() -> None:
    """nav.js is one file behind every page's own cache stamp.

    A new menu entry only appears for a returning visitor if the stamp on the page they load
    changed, so a nav change means a site-wide restamp. One stamp across all pages also means the
    next change is a single sweep rather than a hunt.
    """
    stamps = set()
    for page in ROOT.glob("*.html"):
        for part in read(page).split('nav.js?v=')[1:]:
            stamps.add(part.split('"')[0].split("'")[0])
    assert stamps, "no page loads the shared nav"
    assert stamps == {"20260827-capability-publication"}, f"unexpected nav.js cache stamps: {sorted(stamps)}"
    assert 'const ASSET_V = "20260827-capability-publication"' in read(NAV)

from __future__ import annotations

import base64
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "current-story.html"
MANIFEST = ROOT / "art" / "current-story" / "manifest.json"
README = ROOT / "art" / "current-story" / "README.md"
ESSAY = ROOT / "pick-the-lock-for-everyone.html"
TALK = ROOT / "pick-the-lock-for-everyone-talk.html"
SCRIPT = ROOT / "system" / "current-story.js"
SITEMAP = ROOT / "sitemap.xml"
CHUNKS = [
    ROOT / "art" / "current-story" / "data" / f"sequence.{index:02d}.b64"
    for index in range(11)
]


def test_current_story_is_public_linked_and_visible_in_the_essay() -> None:
    for path in (PAGE, MANIFEST, README, ESSAY, TALK, SCRIPT, SITEMAP, *CHUNKS):
        assert path.is_file(), path

    page = PAGE.read_text(encoding="utf-8")
    essay = ESSAY.read_text(encoding="utf-8")
    script = SCRIPT.read_text(encoding="utf-8")

    assert "<title>Current Story &mdash; Zain Dana Harper</title>" in page
    assert '<link rel="canonical" href="https://harperz9.github.io/current-story.html">' in page
    assert "Seventeen images, shown in the order they were made." in page
    assert 'href="current-story.html"' in essay
    assert 'href="current-story.html"' in TALK.read_text(encoding="utf-8")
    assert "https://harperz9.github.io/current-story.html" in SITEMAP.read_text(encoding="utf-8")

    assert "data-current-story-full" in page
    assert 'src="system/current-story.js?v=20260723-inline-art"' in page
    assert "data-current-story-rail" in essay
    assert "Visual coda · chronological" in essay
    assert "The images follow the argument." in essay
    assert essay.index('class="article-body"') < essay.index("data-current-story-rail")
    assert "data-story-previous" in essay
    assert "data-story-next" in essay
    assert 'src="system/current-story.js?v=20260723-inline-art-coda"' in essay
    assert "const CHUNK_COUNT = 11;" in script
    assert 'document.querySelectorAll("[data-current-story-rail]")' in script


def test_current_story_preserves_numeric_chronology_and_receipt() -> None:
    page = PAGE.read_text(encoding="utf-8")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    expected_sources = [f"100011{number}.png" for number in range(9276, 9293)]
    expected_chunks = [
        f"art/current-story/data/sequence.{index:02d}.b64"
        for index in range(11)
    ]

    assert [item["sequence"] for item in manifest["images"]] == list(range(1, 18))
    assert [item["source_filename"] for item in manifest["images"]] == expected_sources
    assert "source 1000119276 &rarr; 1000119292" in page

    composite = manifest["published_composite"]
    assert composite["dimensions"] == {"width": 320, "height": 7184}
    assert composite["plate_dimensions"] == {"width": 320, "height": 400}
    assert composite["gap_pixels"] == 24
    assert composite["chunks"] == expected_chunks

    encoded_parts = [path.read_text(encoding="utf-8").strip() for path in CHUNKS]
    assert sum(map(len, encoded_parts)) == composite["base64_characters"] == 108924
    decoded = base64.b64decode("".join(encoded_parts), validate=True)
    assert decoded[:4] == b"RIFF"
    assert len(decoded) == composite["decoded_bytes"] == 81692
    assert hashlib.sha256(decoded).hexdigest() == composite["decoded_sha256"]

    for item in manifest["images"]:
        assert item["alt"] in page


def test_plate_grid_is_present_and_accessible():
    """The sequence page must offer the works individually, not only as one strip.

    The page shipped seventeen works as a single 320x7184 image carrying one alt sentence for all
    of them. That reads the sequence well and reads any single work not at all: there was no way
    to view one plate, and a screen reader received one description for seventeen pieces. The
    grid slices the same composite the strip already loads, so this costs no new asset.
    """
    html = (ROOT / "current-story.html").read_text(encoding="utf-8")
    assert 'data-current-story-grid' in html, "the plate grid mounts"
    assert 'data-current-story-grid-target' in html, "the grid has a render target"
    assert 'system/current-story.css' in html, "the grid's stylesheet is linked"
    # The strip is not replaced by the grid; both views ship.
    assert 'data-current-story-full' in html, "the uninterrupted strip survives"
    assert '<noscript>' in html, "a scriptless reader still gets a route to the manifest"

    js = (ROOT / "system" / "current-story.js").read_text(encoding="utf-8")
    # Each plate is a real control with its own name, and the lightbox is keyboard-navigable.
    assert 'plate.type = "button"' in js, "a plate is a button, not a picture of one"
    assert 'Open work ${index + 1} of ${items.length}' in js, "each plate names the work it opens"
    assert 'ArrowLeft' in js and 'ArrowRight' in js, "the lightbox moves by arrow key"
    assert 'aria-live' in js, "the lightbox announces its position"
    assert 'showModal' in js, "the dialog is modal, so focus is trapped and restored"


def test_plate_grid_uses_the_existing_composite_only():
    """No new art asset backs the grid: it slices the composite the manifest already declares."""
    js = (ROOT / "system" / "current-story.js").read_text(encoding="utf-8")
    # The retired sprite pipelines must never come back through this door.
    for dead in ("hq-data", "avif-data", "avif25-data"):
        assert dead not in js, f"{dead} was a retired pipeline and must not be referenced"
    manifest = json.loads((ROOT / "art" / "current-story" / "manifest.json").read_text(encoding="utf-8"))
    composite = manifest["published_composite"]
    plate = composite["plate_dimensions"]
    gap = composite["gap_pixels"]
    count = len(manifest["images"])
    # The slicing arithmetic in the JS only holds if the strip really is plate+gap stacked.
    assert plate["height"] * count + gap * (count - 1) == composite["dimensions"]["height"], \
        "the composite is plates stacked with gaps, which is what the grid slices"

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
SITEMAP = ROOT / "sitemap.xml"
CHUNKS = [
    ROOT / "art" / "current-story" / "data" / f"sequence.{index:02d}.b64"
    for index in range(11)
]


def test_current_story_is_public_and_linked() -> None:
    for path in (PAGE, MANIFEST, README, ESSAY, TALK, SITEMAP, *CHUNKS):
        assert path.is_file(), path

    page = PAGE.read_text(encoding="utf-8")
    assert "<title>Current Story &mdash; Zain Dana Harper</title>" in page
    assert '<link rel="canonical" href="https://harperz9.github.io/current-story.html">' in page
    assert "Seventeen images, shown in the order they were made." in page
    assert 'href="current-story.html"' in ESSAY.read_text(encoding="utf-8")
    assert 'href="current-story.html"' in TALK.read_text(encoding="utf-8")
    assert "https://harperz9.github.io/current-story.html" in SITEMAP.read_text(encoding="utf-8")
    assert "{ length: 11 }" in page


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

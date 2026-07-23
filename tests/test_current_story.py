from __future__ import annotations

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


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_current_story_is_public_and_linked() -> None:
    for path in (PAGE, MANIFEST, README, ESSAY, TALK, SITEMAP):
        assert path.is_file(), path

    page = PAGE.read_text(encoding="utf-8")
    essay = ESSAY.read_text(encoding="utf-8")
    talk = TALK.read_text(encoding="utf-8")
    sitemap = SITEMAP.read_text(encoding="utf-8")

    assert "<title>Current Story &mdash; Zain Dana Harper</title>" in page
    assert '<link rel="canonical" href="https://harperz9.github.io/current-story.html">' in page
    assert "Seventeen images, shown in the order they were made." in page
    assert 'href="current-story.html"' in essay
    assert 'href="current-story.html"' in talk
    assert "https://harperz9.github.io/current-story.html" in sitemap


def test_current_story_preserves_numeric_chronology_and_receipts() -> None:
    page = PAGE.read_text(encoding="utf-8")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))

    expected_sources = [f"100011{number}.png" for number in range(9276, 9293)]
    expected_paths = [f"img/current-story/{index:02d}.webp" for index in range(1, 18)]

    assert manifest["ordering"].startswith("Ascending numeric source filename")
    assert [item["sequence"] for item in manifest["images"]] == list(range(1, 18))
    assert [item["source_filename"] for item in manifest["images"]] == expected_sources
    assert [item["published_path"] for item in manifest["images"]] == expected_paths

    positions = [page.index(path) for path in expected_paths]
    assert positions == sorted(positions)

    for item in manifest["images"]:
        image = ROOT / item["published_path"]
        assert image.is_file(), image
        assert image.read_bytes()[:4] == b"RIFF"
        assert sha256(image) == item["published_sha256"]
        assert item["published_dimensions"] == {"width": 640, "height": 800}
        assert item["alt"] in page

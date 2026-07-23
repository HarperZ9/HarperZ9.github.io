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
COMPOSITE = ROOT / "img" / "current-story" / "sequence.webp"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_current_story_is_public_and_linked() -> None:
    for path in (PAGE, MANIFEST, README, ESSAY, TALK, SITEMAP, COMPOSITE):
        assert path.is_file(), path
    page = PAGE.read_text(encoding="utf-8")
    assert "<title>Current Story &mdash; Zain Dana Harper</title>" in page
    assert "Seventeen images, shown in the order they were made." in page
    assert 'href="current-story.html"' in ESSAY.read_text(encoding="utf-8")
    assert 'href="current-story.html"' in TALK.read_text(encoding="utf-8")
    assert "https://harperz9.github.io/current-story.html" in SITEMAP.read_text(encoding="utf-8")


def test_current_story_preserves_numeric_chronology_and_receipts() -> None:
    page = PAGE.read_text(encoding="utf-8")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    expected = [f"100011{number}.png" for number in range(9276, 9293)]
    assert [item["sequence"] for item in manifest["images"]] == list(range(1, 18))
    assert [item["source_filename"] for item in manifest["images"]] == expected
    assert "source 1000119276 &rarr; 1000119292" in page
    composite = manifest["published_composite"]
    assert composite["path"] == "img/current-story/sequence.webp"
    assert composite["dimensions"] == {"width": 640, "height": 14368}
    assert COMPOSITE.read_bytes()[:4] == b"RIFF"
    assert sha256(COMPOSITE) == composite["sha256"]
    for item in manifest["images"]:
        assert item["alt"] in page

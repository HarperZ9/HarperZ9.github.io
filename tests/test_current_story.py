from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ESSAY = ROOT / "pick-the-lock-for-everyone.html"
PAGE = ROOT / "current-story.html"
SCRIPT = ROOT / "system" / "current-story.js"
STYLE = ROOT / "system" / "current-story.css"
MANIFEST = ROOT / "art" / "current-story" / "manifest.json"
README = ROOT / "art" / "current-story" / "README.md"
SITEMAP = ROOT / "sitemap.xml"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_visual_coda_is_after_the_essay() -> None:
    for path in (ESSAY, PAGE, SCRIPT, STYLE, MANIFEST, README, SITEMAP):
        assert path.is_file(), path

    essay = read(ESSAY)
    assert 'class="article-body"' in essay
    assert 'class="visual-coda"' in essay
    assert essay.index('class="article-body"') < essay.index('class="visual-coda"')
    assert "Visual coda · 27 frames · high resolution" in essay
    assert "visual-prologue" not in essay
    assert 'data-current-story-rail' in essay
    assert 'data-current-story-grid' in read(PAGE)
    assert "https://harperz9.github.io/current-story.html" in read(SITEMAP)


def test_manifest_preserves_both_movements_and_high_resolution_assets() -> None:
    manifest = json.loads(read(MANIFEST))
    images = manifest["images"]
    sprites = manifest["published_assets"]["sprites"]

    assert len(images) == 27
    assert [item["sequence"] for item in images] == list(range(1, 28))
    assert [item["source_filename"] for item in images[:17]] == [
        f"100011{number}.png" for number in range(9276, 9293)
    ]
    assert [item["source_filename"] for item in images[17:]] == [
        "f6259f82-44d3-4684-b193-347bb59b05a0.png",
        "ChatGPT Image Jul 21, 2026, 08_13_22 PM (1).png",
        "ChatGPT Image Jul 21, 2026, 08_13_22 PM (2).png",
        "ChatGPT Image Jul 21, 2026, 08_13_22 PM (3).png",
        "887e81f0-8e7b-4335-bec6-2ca1444197c9.png",
        "f38e019c-97ed-4bc7-93b5-38f7e3c1e671.png",
        "7eed340d-66b0-44c1-a96f-fa72899ae718.png",
        "c111f74e-c630-4850-8aef-2c7524a00574.png",
        "ChatGPT Image Jul 20, 2026, 06_32_55 PM (2).png",
        "ChatGPT Image Jul 20, 2026, 09_34_36 PM.png",
    ]
    assert {item["movement"] for item in images[:17]} == {"current-story"}
    assert {item["movement"] for item in images[17:]} == {"continuation"}
    assert manifest["published_assets"]["frame_dimensions"] == {
        "width": 1024,
        "height": 1280,
    }
    assert len(sprites) == 3

    for sprite in sprites:
        path = ROOT / sprite["path"]
        assert path.is_file(), path
        data = path.read_bytes()
        assert data[:4] == b"RIFF"
        assert hashlib.sha256(data).hexdigest() == sprite["sha256"]
        assert len(data) == sprite["bytes"]
        assert sprite["frame_dimensions"] == {"width": 1024, "height": 1280}

    for item in images:
        assert 0 <= item["sprite_index"] <= 2
        assert 0 <= item["frame_index"] <= 8
        assert item["alt"]


def test_renderer_uses_binary_sprites_and_accessible_large_view() -> None:
    script = read(SCRIPT)
    assert "hq-sprite" not in script  # asset paths are manifest-driven
    assert "data-current-story-dialog" in script
    assert "IntersectionObserver" in script
    assert "backgroundSize" in script
    assert "base64" not in script.lower()
    assert "CHUNK_COUNT" not in script
    assert "FRAME_WIDTH = 320" not in script

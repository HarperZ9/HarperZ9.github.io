"""Contracts for the plugin icons under plugins/icons/."""

from __future__ import annotations

import copy
import json
import re
from pathlib import Path

import pytest

from tools import plugin_support_sources as sources
from tools import render_plugin_icons as render
from tools.plugin_icons import PNG_SIZES, icon_files

ROOT = Path(__file__).resolve().parents[1]
MAX_BYTES = 5 * 1024 * 1024  # OpenAI: at most 5 MiB per image


def manifest() -> dict:
    return json.loads((ROOT / render.MANIFEST).read_text(encoding="utf-8"))


def test_every_png_matches_its_svg_and_size() -> None:
    assert render.verify(manifest()) == []


def test_verify_catches_a_changed_svg_and_a_wrong_size() -> None:
    bad = copy.deepcopy(manifest())
    bad["icons"][0]["source_sha256"] = "0" * 64
    bad["icons"][1]["size"] = 49
    problems = render.verify(bad)
    assert any("changed; re-render" in p for p in problems)
    assert any("not 49x49" in p for p in problems)


def test_exports_meet_the_directory_size_rules() -> None:
    sizes = {entry["size"] for entry in manifest()["icons"]}
    assert min(sizes) >= 48 and max(sizes) <= 4096
    assert set(PNG_SIZES) <= sizes
    for path in (ROOT / "plugins/icons").rglob("*"):
        if path.suffix in {".png", ".svg"}:
            assert path.stat().st_size <= MAX_BYTES, path.name


def test_svg_masters_are_square_and_named() -> None:
    for tool in sources.load_tools():
        for rel, text in icon_files(tool.slug, tool.label).items():
            assert 'viewBox="0 0 1024 1024"' in text, rel
            assert f"<title>{tool.label}</title>" in text, rel
            assert chr(0x2014) not in text, rel


def test_tiles_are_opaque_and_glyphs_are_transparent() -> None:
    image = pytest.importorskip("PIL.Image")
    for tool in sources.load_tools():
        tile = image.open(ROOT / f"plugins/icons/png/{tool.slug}-48.png").convert("RGBA")
        glyph = image.open(ROOT / f"plugins/icons/png/{tool.slug}-glyph-128.png").convert("RGBA")
        assert tile.getpixel((0, 0))[3] == 255 and tile.getpixel((47, 47))[3] == 255
        assert glyph.getpixel((0, 0))[3] == 0 and glyph.getpixel((127, 127))[3] == 0
        assert glyph.getpixel((64, 64))[3] > 0  # the pupil dot is drawn


def test_pages_show_and_link_every_icon() -> None:
    hub = (ROOT / "plugins/index.html").read_text(encoding="utf-8")
    listing = json.loads((ROOT / "plugins/plugins.json").read_text(encoding="utf-8"))
    for tool in sources.load_tools():
        assert f'src="icons/png/{tool.slug}-128.png"' in hub
        page = (ROOT / f"plugins/{tool.slug}/support.html").read_text(encoding="utf-8")
        for href in re.findall(r'(?:href|src)="(\.\./icons/[^"]+)"', page):
            assert (ROOT / "plugins" / tool.slug / href).resolve().is_file(), href
    for entry in listing["plugins"]:
        slug = entry["support_url"].split("/")[-2]
        assert entry["icon_svg"].endswith(f"/plugins/icons/{slug}.svg")

"""system/kit is the site's design for standalone pages; these checks keep it tied to its source.

- Every token the kit shares with world/ui/shell carries a value the shell also uses, except the
  deviations listed below, each with its reason. A new drift fails, and so does a stale exception.
- Every font the kit names is a file the site already ships; the kit copies no font bytes.
- The specimen's inlined block equals a fresh build from kit.css and kit.js.
"""
from __future__ import annotations

import importlib.util
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KIT = ROOT / "system" / "kit"
SOURCES = ("world/ui/shell/shell.css", "world/ui/shell/type.css", "world/ui/shell/organic/organic.css")

# Kit values that differ from the shell, as found when the kit moved here (README.md, "Where the kit
# differs from the shell"). Keyed by token, valued by the kit's value and what is known about it.
DEVIATIONS = {
    "--card": ("#1a1918", "dark card: the kit keeps a dark card where the shell's dark --card is #d9d1bf; reason not recorded"),
    "--lamp": ("rgba(255,250,238,0)", "same colour as the site, written 0 instead of .0"),
    "--face-text": ('"Accession Text","Hanken Grotesk",system-ui,sans-serif', "the site's --house-text resolved"),
    "--face-display": ('"Accession Display","Hanken Grotesk",system-ui,sans-serif', "the site's --house-display resolved"),
    "--face-utility": ('"Accession Mono","Conso",ui-monospace,monospace', "the site's --house-mono resolved"),
    "--fs-6": ("40px", "the kit's step under 860 px; the shell uses 36px there; reason not recorded"),
    "--grain": (".07", "heavier grain than the shell's .05; reason not recorded"),
}


def _tokens(text: str) -> dict[str, set[str]]:
    out: dict[str, set[str]] = {}
    for name, value in re.findall(r"(--[a-z0-9-]+)\s*:\s*([^;}]+)", re.sub(r"/\*.*?\*/", "", text, flags=re.S)):
        out.setdefault(name, set()).add(value.strip())
    return out


def _source_tokens() -> dict[str, set[str]]:
    merged: dict[str, set[str]] = {}
    for rel in SOURCES:
        for name, values in _tokens((ROOT / rel).read_text(encoding="utf-8")).items():
            merged.setdefault(name, set()).update(values)
    return merged


def test_shared_tokens_match_the_shell_or_are_listed_deviations():
    kit = _tokens((KIT / "kit.css").read_text(encoding="utf-8"))
    src = _source_tokens()
    shared = [name for name in kit if name in src]
    assert len(shared) >= 30, "the kit and the shell share too few tokens; the parser or a source moved"
    drift = {}
    for name in shared:
        extra = kit[name] - src[name]
        if extra and DEVIATIONS.get(name, (None,))[0] not in extra:
            drift[name] = sorted(extra)
    assert not drift, f"kit tokens drifted from world/ui/shell: {drift}"
    for name, (value, _why) in DEVIATIONS.items():
        assert value in kit.get(name, set()), f"stale deviation {name}: the kit no longer writes {value}"
        assert value not in src.get(name, set()), f"stale deviation {name}: the shell now writes {value}"


def test_every_kit_font_is_a_site_file_and_no_font_bytes_are_copied():
    css = (KIT / "kit.css").read_text(encoding="utf-8")
    urls = re.findall(r'url\("(\.\./fonts/[^"]+)"\)', css)
    assert len(urls) >= 10
    for url in urls:
        assert (KIT / url).resolve().is_file(), url
    assert not [p for p in KIT.rglob("*") if p.suffix in {".woff", ".woff2", ".ttf", ".otf"}]


def _inline():
    spec = importlib.util.spec_from_file_location("system_kit_inline", KIT / "inline.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_the_specimen_carries_a_fresh_build_of_the_kit():
    inline = _inline()
    page = KIT / "specimen.html"
    html = page.read_text(encoding="utf-8")
    assert inline.inline_kit(html, page) == html, "run: python system/kit/inline.py system/kit/specimen.html"


def test_inlined_font_urls_resolve_from_a_page_elsewhere(tmp_path):
    inline = _inline()
    page = ROOT / "world" / "kit-probe.html"
    block = inline.kit_block(page)
    urls = re.findall(r'url\("([^"]+\.woff2)"\)', block)
    assert urls and all((page.parent / u).resolve().is_file() for u in urls)
    assert "map.js" not in block, "the site ships no workshop map"
    out = inline.inline_kit("<html><head><style>p{}</style></head></html>", tmp_path / "p.html")
    assert out.index("site-kit:begin") < out.index("<style>p{}")

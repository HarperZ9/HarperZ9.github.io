"""Guard against committing unreferenced hashed assets/index-*.{js,css} bundles."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BUNDLE_PATTERN = re.compile(r"/assets/(index-[A-Za-z0-9_-]+\.(?:js|css))")
EXCLUDED_DIRS = {".git", "node_modules", "tests", "project-docs", "docs"}


def referenced_index_bundles(root: Path) -> set[str]:
    """Return all assets/index-*.{js,css} basenames referenced by live HTML pages."""
    referenced: set[str] = set()
    for html in root.rglob("*.html"):
        rel_parts = html.relative_to(root).parts
        if any(part in EXCLUDED_DIRS for part in rel_parts):
            continue
        text = html.read_text(encoding="utf-8", errors="ignore")
        referenced.update(BUNDLE_PATTERN.findall(text))
    return referenced


def find_unreferenced_index_bundles(root: Path) -> list[str]:
    """Return sorted relative paths of assets/index-*.{js,css} files with no live HTML reference."""
    assets_dir = root / "assets"
    if not assets_dir.is_dir():
        return []
    live = referenced_index_bundles(root)
    dead: list[str] = []
    for candidate in sorted(assets_dir.glob("index-*")):
        if candidate.suffix not in {".js", ".css"} or not candidate.is_file():
            continue
        if candidate.name not in live:
            dead.append(candidate.relative_to(root).as_posix())
    return dead


def test_no_unreferenced_index_bundles_committed() -> None:
    dead = find_unreferenced_index_bundles(ROOT)
    assert not dead, (
        "Unreferenced hashed index bundles found in assets/. "
        "Remove superseded bundles and their tests/release-pins/assets/*.pin files: "
        + ", ".join(dead)
    )


def test_detector_catches_planted_dead_bundle(tmp_path: Path) -> None:
    (tmp_path / "workshop.html").write_text(
        '<script type="module" src="/assets/index-LIVE1234.js"></script>\n'
        '<link rel="stylesheet" href="/assets/index-LIVE5678.css">\n',
        encoding="utf-8",
    )
    assets = tmp_path / "assets"
    assets.mkdir()
    (assets / "index-LIVE1234.js").write_text("console.log('ok');\n", encoding="utf-8")
    (assets / "index-LIVE5678.css").write_text("body{}\n", encoding="utf-8")
    assert find_unreferenced_index_bundles(tmp_path) == []

    (assets / "index-DEAD9999.js").write_text("// superseded bundle\n", encoding="utf-8")
    assert find_unreferenced_index_bundles(tmp_path) == ["assets/index-DEAD9999.js"]

"""Live-tree contracts for the Flywheel-first Retro Systems Lab release."""

from __future__ import annotations

import hashlib
import json
import struct
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
PILLAR_PAGES = (
    "flywheel.html",
    "retro.html",
    "engine-revival.html",
    "brender-archival.html",
)
LAB_PAGES = (
    "retro.html",
    "engine-revival.html",
    "brender-archival.html",
)
LAB_LINKS = set(LAB_PAGES)
MEDIA_MANIFEST = ROOT / "media" / "retro-systems-lab" / "manifest.json"


class _References(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.references: list[str] = []
        self.images: list[dict[str, str | None]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        for attribute in ("href", "src"):
            value = values.get(attribute)
            if value:
                self.references.append(value)
        if tag == "img":
            self.images.append(values)


def _local_path(reference: str) -> Path | None:
    parsed = urlsplit(reference)
    if parsed.scheme or parsed.netloc or reference.startswith(("mailto:", "#")):
        return None
    relative = parsed.path.lstrip("/")
    if not relative:
        relative = "index.html"
    if relative.endswith("/"):
        relative += "index.html"
    return ROOT / relative


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _png_dimensions(path: Path) -> tuple[int, int]:
    payload = path.read_bytes()
    assert payload.startswith(b"\x89PNG\r\n\x1a\n"), path
    return struct.unpack(">II", payload[16:24])


def test_flywheel_and_retro_pillar_routes_resolve_with_reciprocal_navigation() -> None:
    for relative in PILLAR_PAGES:
        page = ROOT / relative
        assert page.is_file(), relative
        source = page.read_text(encoding="utf-8")
        parser = _References()
        parser.feed(source)

        unresolved = sorted(
            reference
            for reference in parser.references
            if (target := _local_path(reference)) is not None and not target.is_file()
        )
        assert not unresolved, f"{relative} has unresolved local references: {unresolved}"

        if relative in LAB_PAGES:
            assert LAB_LINKS <= set(parser.references), relative
            assert "flywheel.html" in parser.references, relative
            assert parser.images, f"{relative} must carry evidence imagery"
            assert all(image.get("alt", "").strip() for image in parser.images), relative


def test_home_bundle_is_atomic_and_all_referenced_assets_exist() -> None:
    source = (ROOT / "index.html").read_text(encoding="utf-8")
    parser = _References()
    parser.feed(source)

    bundles = [
        reference
        for reference in parser.references
        if reference.startswith("/assets/index-")
    ]
    assert len(bundles) == 2, bundles
    assert {Path(urlsplit(reference).path).suffix for reference in bundles} == {".js", ".css"}
    assert all((_local_path(reference) or Path()).is_file() for reference in bundles)


def test_retro_media_manifest_matches_public_artifacts() -> None:
    manifest = json.loads(MEDIA_MANIFEST.read_text(encoding="utf-8"))
    assert manifest["schema"] == "harperz9-retro-systems-lab-media/v1"

    records = manifest["media"]
    assert len(records) >= 6
    for record in records:
        path = ROOT / record["href"].lstrip("/")
        assert path.is_file(), record["href"]
        assert path.stat().st_size == record["bytes"], record["id"]
        assert path.stat().st_size <= record["byteBudget"], record["id"]
        assert _sha256(path) == record["sha256"], record["id"]
        assert record["alt"].strip(), record["id"]
        assert record["caption"].strip(), record["id"]
        assert record["limitations"], record["id"]
        assert "does not prove" in " ".join(record["limitations"]).lower(), record["id"]
        if path.suffix == ".png":
            assert _png_dimensions(path) == (record["width"], record["height"])


def test_retro_release_surfaces_do_not_expose_owner_local_paths() -> None:
    payload = "\n".join(
        (ROOT / relative).read_text(encoding="utf-8")
        for relative in (*PILLAR_PAGES, "media/retro-systems-lab/manifest.json")
    ).lower()
    for blocked in ("c:/", "c:\\", "/users/zain", "file://"):
        assert blocked not in payload

from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "art" / "session-archive" / "manifest.json"
PAGE = ROOT / "session-archive.html"
SCRIPT = ROOT / "system" / "session-archive.js"


def manifest() -> dict:
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def test_the_archive_publishes_the_whole_body_of_work() -> None:
    """The sequence page shows seventeen chosen works. This shows all of them.

    Publishing only the chosen ones makes the choosing invisible, and the choosing is most of the
    authorship, so the archive is published whole rather than curated down.
    """
    assert PAGE.is_file() and SCRIPT.is_file()
    m = manifest()
    works = m["works"]
    assert len(works) == m["counts"]["works"] > 100, "the archive is the whole body, not a selection"
    ids = [w["id"] for w in works]
    assert len(set(ids)) == len(ids), "no work appears twice"
    kinds = {w["kind"] for w in works}
    assert kinds <= {"single", "collage"}


def test_every_work_carries_the_hash_of_what_it_came_from() -> None:
    """The chain from the session archive to this page has to be checkable, not trusted."""
    m = manifest()
    for w in m["works"]:
        src = w["source_asset"]
        for key in ("name", "archive", "png_sha256", "png_bytes"):
            assert src.get(key), f"{w['id']}: source_asset.{key} missing"
        assert len(src["png_sha256"]) == 64

        thumb = ROOT / w["thumb"]
        assert thumb.is_file(), w["thumb"]
        assert hashlib.sha256(thumb.read_bytes()).hexdigest() == w["thumb_sha256"], \
            f"{w['thumb']} drifted from its recorded hash"

        full = ROOT / w["full"]
        assert full.is_file(), w["full"]
        # Works that are also Current Story plates reuse that file rather than shipping the same
        # pixels twice, so they carry no separate hash of their own here.
        if "full_sha256" in w:
            assert hashlib.sha256(full.read_bytes()).hexdigest() == w["full_sha256"], \
                f"{w['full']} drifted from its recorded hash"
        else:
            assert w.get("also_published_as"), f"{w['id']}: reused file must say where it is published"


def test_the_reference_collage_is_excluded_and_the_exclusion_is_stated() -> None:
    """One generated collage reproduces the inspiration images supplied to the session.

    Those are other people's artwork. It is excluded, and the manifest says which file and why,
    because a silent omission from an archive that calls itself whole is a false claim.
    """
    m = manifest()
    assert m["counts"]["excluded"] >= 1
    excluded = m["excluded_items"]
    assert excluded and all(e.get("name") and e.get("why") for e in excluded)
    assert any("inspiration" in e["why"] or "third-party" in e["why"] for e in excluded)
    names = {w["source_asset"]["name"] for w in m["works"]}
    for e in excluded:
        assert e["name"] not in names, f"{e['name']} is excluded but still published"
    page = PAGE.read_text(encoding="utf-8")
    assert "other" in page and "people" in page, "the page states the exclusion in its own words"


def test_the_page_stays_cheap_for_a_hundred_and_sixty_five_works() -> None:
    """58MB of full-size work must not arrive because someone opened the page."""
    js = SCRIPT.read_text(encoding="utf-8")
    assert 'loading = "lazy"' in js or 'im.loading = "lazy"' in js, "thumbnails load lazily"
    # The grid must render thumbnails, never the full copies.
    grid = js[js.index("async function render"):]
    assert "w.thumb" in grid, "the grid draws thumbnails"
    assert "im.src = w.full" not in grid, "the grid must not load full copies"
    m = manifest()
    thumbs = sum(w["thumb_bytes"] for w in m["works"])
    assert thumbs < 12 * 1024 * 1024, f"thumbnail payload too heavy: {thumbs/1024/1024:.1f}MB"
    for w in m["works"]:
        assert max(w["thumb_dimensions"]) <= 420, f"{w['id']}: thumbnail is not a thumbnail"


def test_the_archive_and_the_sequence_point_at_each_other() -> None:
    """Someone landing on either page should be able to find the other."""
    page = PAGE.read_text(encoding="utf-8")
    assert "current-story.html" in page
    m = manifest()
    shared = [w for w in m["works"] if w.get("also_published_as")]
    assert shared, "works published in both places say so"
    for w in shared:
        assert w["full"].startswith("art/current-story/"), "a shared work reuses the sequence's file"


def test_manifest_fetches_are_version_stamped() -> None:
    """A force-cache fetch with no version stamp is a permanent stale read.

    Both manifests are fetched with ``cache: "force-cache"``, which is right for a file that
    rarely changes and wrong the moment it does: a visitor who loaded the page before the plates
    were recovered keeps their cached manifest and never sees the higher-resolution copies. This
    repo already applies the same rule to the stylesheet; a data manifest that changes shape
    earns it too.
    """
    for script, path in ((SCRIPT, "art/session-archive/manifest.json"),
                         (ROOT / "system" / "current-story.js", "art/current-story/manifest.json")):
        js = script.read_text(encoding="utf-8")
        assert "force-cache" in js, f"{script.name}: expected a cached manifest fetch"
        assert f'{path}?v=' in js, f"{script.name}: the manifest fetch needs a version stamp"

"""The conclusions companion record: its sealed checksum, its publication gate and its dated page.

A companion record carries conclusions written after an edition was published. It must survive
the next edition, so the builder renders it on frontier-safety/conclusions/<date>.html; it must
match the checksum sealed in data/conclusions/checksums.json; and it must belong to a published
edition.
"""

from __future__ import annotations

import json
import re
import shutil
from copy import deepcopy
from pathlib import Path

import pytest

from test_frontier_safety_conclusions import BUILDER, CURRENT, DATE, EDITION_PATH, EXPECTED, ROOT, record

import frontier_safety_conclusions_record as conclusions  # noqa: E402  (the builder put tools/ on sys.path)


DATA = ROOT / "frontier-safety" / "data"
RECORD_PAGE = ROOT / "frontier-safety" / "conclusions" / f"{DATE}.html"
NEXT = "2026-09-30"


@pytest.fixture
def published(tmp_path: Path) -> Path:
    """A copy of the published record, laid out as the builder reads and writes it."""
    data = tmp_path / "frontier-safety" / "data"
    for folder in ("archive", "conclusions", "editions"):
        shutil.copytree(DATA / folder, data / folder)
    shutil.copy(DATA / "history.json", data / "history.json")
    for relative in (f"frontier-safety/archive/{DATE}.html", f"frontier-safety/social/{DATE}-x.txt",
                     f"frontier-safety/social/{DATE}-linkedin.txt"):
        (tmp_path / relative).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(ROOT / relative, tmp_path / relative)
    return tmp_path


def companion(root: Path, date: str = DATE) -> Path:
    return root / "frontier-safety" / "data" / "conclusions" / f"{date}.json"


def edition_path(root: Path, date: str = DATE) -> Path:
    return root / "frontier-safety" / "data" / "editions" / f"{date}.json"


def test_the_companion_matches_its_sealed_checksum() -> None:
    sealed = json.loads((DATA / "conclusions" / "checksums.json").read_text(encoding="utf-8"))
    payload = json.loads(companion(ROOT).read_text(encoding="utf-8"))
    assert payload["schema_version"] == conclusions.COMPANION_SCHEMA_VERSION
    assert sealed == {"schema_version": 1, "records": {DATE: conclusions.canonical_sha256(payload)}}


def test_the_addendum_build_is_byte_stable(tmp_path: Path) -> None:
    BUILDER.build(EDITION_PATH, tmp_path)
    for relative in ("frontier-safety.html", "frontier-safety/data/current.json",
                     f"frontier-safety/conclusions/{DATE}.html"):
        assert (tmp_path / relative).read_bytes() == (ROOT / relative).read_bytes(), relative
    stripped = deepcopy(CURRENT)
    stripped.pop("conclusions_addendum")
    archived = tmp_path / "frontier-safety" / "data" / "archive" / f"{DATE}.json"
    assert json.loads(archived.read_text(encoding="utf-8")) == stripped


def test_an_edited_companion_is_refused_until_it_is_sealed_again(published: Path) -> None:
    path = companion(published)
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["conclusions"][0]["lead"] = payload["conclusions"][0]["lead"].replace("None of", "Not one of")
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    with pytest.raises(BUILDER.EditionError, match="does not match its sealed checksum"):
        BUILDER.build(edition_path(published), published)
    conclusions.seal(published / "frontier-safety" / "data", DATE)
    BUILDER.build(edition_path(published), published)
    assert "Not one of the four control rows" in (published / "frontier-safety.html").read_text(encoding="utf-8")


def test_a_companion_without_a_sealed_checksum_is_refused(published: Path) -> None:
    (published / "frontier-safety" / "data" / "conclusions" / "checksums.json").unlink()
    with pytest.raises(BUILDER.EditionError, match="does not match its sealed checksum"):
        BUILDER.build(edition_path(published), published)


def test_a_companion_for_an_unpublished_edition_is_refused(tmp_path: Path) -> None:
    data = tmp_path / "data"
    (data / "editions").mkdir(parents=True)
    (data / "conclusions").mkdir()
    (data / "editions" / f"{DATE}.json").write_text(json.dumps(record()), encoding="utf-8")
    shutil.copy(companion(ROOT), data / "conclusions" / f"{DATE}.json")
    conclusions.seal(data, DATE)
    with pytest.raises(BUILDER.EditionError, match="belongs to an edition that is not published"):
        BUILDER.build(data / "editions" / f"{DATE}.json", tmp_path / "out")


def test_a_stray_companion_for_a_later_unpublished_edition_is_refused(published: Path) -> None:
    payload = json.loads(companion(published).read_text(encoding="utf-8"))
    payload["edition_date"] = NEXT
    companion(published, NEXT).write_text(json.dumps(payload), encoding="utf-8")
    conclusions.seal(published / "frontier-safety" / "data", NEXT)
    with pytest.raises(BUILDER.EditionError, match=f"companion {NEXT}.json belongs to an edition that is not"):
        BUILDER.build(edition_path(published), published)


def test_an_addendum_for_another_date_is_refused(published: Path) -> None:
    payload = json.loads(companion(published).read_text(encoding="utf-8"))
    payload["edition_date"] = "2026-09-16"
    companion(published).write_text(json.dumps(payload), encoding="utf-8")
    with pytest.raises(BUILDER.EditionError, match="names another edition date"):
        BUILDER.build(edition_path(published), published)


def test_the_builder_keeps_the_addendum_out_of_the_edition_file(published: Path) -> None:
    carried = record()
    carried["conclusions_addendum"] = deepcopy(CURRENT["conclusions_addendum"])
    edition_path(published).write_text(json.dumps(carried), encoding="utf-8")
    with pytest.raises(BUILDER.EditionError, match="belongs in data/conclusions"):
        BUILDER.build(edition_path(published), published)


def test_the_conclusions_survive_the_next_edition(published: Path) -> None:
    following = record()
    following["edition_date"] = NEXT
    edition_path(published, NEXT).write_text(json.dumps(following), encoding="utf-8")
    BUILDER.build(edition_path(published, NEXT), published)
    kept = published / "frontier-safety" / "conclusions" / f"{DATE}.html"
    assert kept.read_bytes() == RECORD_PAGE.read_bytes()
    live = (published / "frontier-safety.html").read_text(encoding="utf-8")
    assert '<section class="mv conclusions"' not in live
    assert f'href="frontier-safety/conclusions/{DATE}.html">Conclusions on the edition of 23 September 2026</a>' in live
    archive = (published / "frontier-safety" / "archive" / f"{NEXT}.html").read_text(encoding="utf-8")
    assert "frontier-safety/conclusions/" not in archive  # a dated archive never links a later record


def test_the_live_page_links_the_dated_record() -> None:
    live = (ROOT / "frontier-safety.html").read_text(encoding="utf-8")
    note = live.split('<p class="conclusions-note">', 1)[1].split("</p>", 1)[0]
    assert f'<a href="frontier-safety/conclusions/{DATE}.html">Dated record of these conclusions</a>' in note
    assert f'href="frontier-safety/conclusions/{DATE}.html">Conclusions on the edition of' in live


def test_the_record_page_carries_every_conclusion_in_the_plate_design() -> None:
    page = RECORD_PAGE.read_text(encoding="utf-8")
    assert '<body class="inner-clean frame-compact frontier-briefing">' in page
    assert 'href="../frontier-safety-edition.css?v=' in page and 'href="../frontier-safety-site.css?v=' in page
    assert f'<link rel="canonical" href="https://harperz9.github.io/frontier-safety/conclusions/{DATE}.html">' in page
    assert "<title>Conclusions on the Frontier Safety Briefing of 2026-09-23 · Zain Dana Harper</title>" in page
    found = set(re.findall(r'<article class="conclusion" id="conclusion-([^"]+)">', page))
    assert found == set(EXPECTED)
    assert "Dated record of these conclusions" not in page
    assert not re.search(r"\b[A-Za-z]:[\\/]|AppData", page)


def test_every_link_on_the_record_page_resolves() -> None:
    page = RECORD_PAGE.read_text(encoding="utf-8")
    archive = (ROOT / "frontier-safety" / "archive" / f"{DATE}.html").read_text(encoding="utf-8")
    archive_ids = set(re.findall(r'\sid="([^"]+)"', archive))
    page_ids = set(re.findall(r'\sid="([^"]+)"', page))
    cited = {s["url"] for lane in CURRENT["lanes"] for item in lane["items"] for s in item["sources"]}
    cited |= {url for control in CURRENT["controls"] for url in control["sources"]}
    evidence = re.findall(r'<div class="conclusion-evidence">(.*?)</div>', page, flags=re.S)
    links = [href for block in evidence for href in re.findall(r'href="([^"]+)"', block)]
    assert len(links) == sum(len(c["evidence"]) for c in CURRENT["conclusions_addendum"]["conclusions"])
    prefix = f"../../frontier-safety/archive/{DATE}.html#"
    for href in links:
        if href.startswith(prefix):
            assert href.removeprefix(prefix) in archive_ids, href
        elif href.startswith("#"):
            assert href[1:] in page_ids, href
        elif href.startswith("https://"):
            assert href in cited, href
        else:
            assert re.fullmatch(r"\.\./\.\./frontier-safety/archive/\d{4}-\d{2}-\d{2}\.html", href), href
            assert (RECORD_PAGE.parent / href).resolve().exists(), href
